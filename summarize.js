var _ = require('lodash'),
  args = require('minimist')(process.argv.slice(2)),
  host = args.h || 'localhost',
  port = Number(args.p) || 6379,
  numKeys = Number(args.n),
  maxPartLength = 40,
  Redis = require('ioredis'),
  results = {},
  separator = ':',
  when = require('when');

function printUsage() {
  console.log('Usage:');
  console.log('  node summarize.js [-h <redis_host>] [-p <redis_port>] -n <num_keys>');
}

if (!numKeys) {
  printUsage();
  process.exit(1);
}

var redis = new Redis({host: host, port: port});

function incorporate(obj, parts) {
  var firstPart = parts.shift();
  if (parts.length) {
    obj[firstPart] = obj[firstPart] || {};
    incorporate(obj[firstPart], parts);
  } else {
    obj[firstPart] = 1;
  }
}

function prune(obj) {
  if (_.isObject(obj)) {
    var sum = _.reduce(_.values(obj), function(sum, n) {
      return sum + Number(n);
    }, 0);
    if (!isNaN(sum)) {
      return sum;
    }
    return _.mapValues(obj, prune);
  }
  return obj;
}

function truncateKeyPart(part) {
  if (part.length > maxPartLength) {
    return part.substr(0, maxPartLength - 3) + '...';
  }
  return part;
}

function parseKey(key) {
  key = _.trim(key, separator);
  var c = key.indexOf('{'),
    s = key.indexOf(separator);
  if (s < 0 || (c > -1 && c < s)) {
    return [truncateKeyPart(key)];
  }
  var firstPart = truncateKeyPart(key.substr(0, s));
  return [firstPart].concat(parseKey(key.substr(s + 1)));
}

function condenseTree(obj) {
  var condensed = obj;
  if (_.isObject(obj)) {
    condensed = {};
    _.each(obj, function(v, p) {
      v = condenseTree(v);
      if (_.isObject(v)) {
        var key, keys = _.keys(v), r = {};
        if (keys.length === 1) {
          key = keys[0];
          condensed[[p, key].join(separator)] = v[key];
          return;
        }
      }
      condensed[p] = v;
    });
  }
  return condensed;
}

function processSampledKey(key) {
  incorporate(results, parseKey(key));
}

function processSampledKeys(keys) {
  _.each(_.uniq(keys.sort()), processSampledKey);
}

when.all(_.times(numKeys, function() {
  return when.promise(function(resolve, reject) {
    redis.randomkey(function(err, key) {
      resolve(key);
    });
  });
}))
  .then(function(keys) {
    processSampledKeys(keys);
    console.log(JSON.stringify(condenseTree(prune(results)), null, 2));
    process.exit(0);
  });
