const express = require("express")
const path = require("path")
const app = express()
const port = 5173


console.log(path.join(__dirname + '/../dist/front/'))
app.use(express.static(path.join(__dirname + '/../dist/front/')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/../dist/front/index.html'))
})
app.get('/game-scene', (req, res) => {
    res.sendFile(path.join(__dirname, '/../dist/front/index.html'))
});
app.get('/score-scene', (req, res) => {
    res.sendFile(path.join(__dirname, '/../dist/front/index.html'))
});
app.get('/casters-scene', (req, res) => {
    res.sendFile(path.join(__dirname, '/../dist/front/index.html'))
});
app.get('/configuration-center', (req, res) => {
    res.sendFile(path.join(__dirname, '/../dist/front/index.html'))
});

app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
})
