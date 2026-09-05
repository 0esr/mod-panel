const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "tools.json");

app.use(express.json());

app.use(express.static(
    path.join(__dirname, "public")
));

/*
 * GET /api/tools
 * يرجع قائمة الأدوات
 */

app.get("/api/tools", (req, res) => {

    try {

        if (!fs.existsSync(DATA_FILE)) {

            return res.json({
                version: "1.0",
                tools: []
            });

        }

        const data =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        const json =
            JSON.parse(data);

        res.json(json);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to load tools"
        });

    }

});


/*
 * Health check
 */

app.get("/api/status", (req, res) => {

    res.json({
        online: true,
        service: "mod-panel-api"
    });

});


/*
 * Start server
 */

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Server running on port ${PORT}`
    );

});