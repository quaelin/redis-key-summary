# redis-key-summary

A Node.js utility that randomly samples redis keys and provides a summary of key
patterns.

Example:
```sh
  node summarize.js -h 127.0.0.1 -p 6379 -n 10000
```

Outputs a JSON object showing numeric breakdown of keys by prefix.
