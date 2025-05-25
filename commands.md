### Start lama
```
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve 
```

### Start website
```
http-server . -p 8000 -a 0.0.0.0
```

### Start Backend
```
node backend.js
```

### start mongo open for all devices
```
/opt/homebrew/bin/mongod --dbpath /opt/homebrew/var/mongodb --bind_ip 0.0.0.0
```
