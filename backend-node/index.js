const express = require('express')
const app = express();

app.get('/', (req,res) => {
    res.json({message: 'Node.js backend is running'})
});

app.listen(3000, () => console.log('Node backend on port 3000'))