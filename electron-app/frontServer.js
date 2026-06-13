const express = require("express")
const path = require("path")
const app = express()
const port = Number(process.env.FRONT_SERVER_PORT) || 5173


console.log(path.join(__dirname + '/../dist/front/'))
app.use(express.static(path.join(__dirname + '/../dist/front/')))

// Note: hack to apply wildcard routing, basically handing over any path for the app's router to handle
app.get('/{*z}', (_, res) => {
    res.sendFile(path.join(__dirname, '/../dist/front/index.html'))
})

app.listen(port, () => {
    console.log(`Default front-end Web server listening on port ${port}`);
})
