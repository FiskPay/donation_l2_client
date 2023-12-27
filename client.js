"use strict";

const { io } = require("socket.io-client");
const Connector = require("./connector.js");
const path = require("node:path");
const fs = require("node:fs");

//
const { emit: originalEmit } = process;
function suppresser(event, error) { return ((event === 'warning' && error.name === 'ExperimentalWarning') ? (false) : (originalEmit.apply(process, arguments))); }
process.emit = suppresser;
//

const dateTime = () => {

    const currentdate = new Date();

    const datetime = ((currentdate.getDate() > 9) ? (currentdate.getDate()) : ("0" + currentdate.getDate())) + "/"
        + ((currentdate.getMonth() > 8) ? (currentdate.getMonth() + 1) : ("0" + (currentdate.getMonth() + 1))) + "/"
        + (currentdate.getFullYear()) + " @ "
        + ((currentdate.getHours() > 9) ? (currentdate.getHours()) : ("0" + currentdate.getHours())) + ":"
        + ((currentdate.getMinutes() > 9) ? (currentdate.getMinutes()) : ("0" + currentdate.getMinutes())) + ":"
        + ((currentdate.getSeconds() > 9) ? (currentdate.getSeconds()) : ("0" + currentdate.getSeconds()));

    return datetime;
}


const client = async () => {

    console.log(dateTime() + " | -----------------------------------------------------------------------------------");
    console.log(dateTime() + " |                 Fiskpay blockchain support for private gameservers                 ");
    console.log(dateTime() + " | -----------------------------------------------------------------------------------");

    try {

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Fetching remote IP address...");

        const remoteIPAddress = (await (await fetch("https://api.ipify.org/?format=json")).json()).ip;

        console.log(dateTime() + " | Remote IP address: " + remoteIPAddress);

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Fetching configuration file...");

        const searchPath = (process.pkg && process.pkg.entrypoint) ? (".") : (path.dirname(process.argv[1]));
        const connectorConfig = JSON.parse(fs.readFileSync(path.join(searchPath, ".config"), { flag: "r", encoding: "utf8" }));

        console.log(dateTime() + " | File found at " + searchPath);

        const serverConnector = new Connector(connectorConfig, remoteIPAddress);
        let serverStatus = {};

        const msgObject = { "step": null, "subject": null, "type": null, "from": null, "to": null, "data": {} };
        const tokenSymbol = "LINK";
        const socketConnector = io("ws://127.0.0.1:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity }); // "wss://donation.fiskpay.com:42099" "ws://127.0.0.1:42099"
        let socketStatus = false;

        serverConnector.on("update", async (id, connected) => {

            if (connected) {

                if (serverStatus[id].v === undefined)
                    serverStatus[id].v = await serverConnector.VALIDATE_SERVER(id);

                if (serverStatus[id].v === true)
                    console.log(dateTime() + " | Server `" + id + "` database connection established");
                else if (await serverConnector.DISCONNECT_SERVER(id))
                    console.log(dateTime() + " | Server `" + id + "` database validation failed");
            }
            else {

                if (serverStatus[id].v !== false)
                    setTimeout(async () => { await serverConnector.CONNECT_SERVER(id); }, 10000);

                if (serverStatus[id].c !== false)
                    console.log(dateTime() + " | Server `" + id + "` database connection failed");
            }

            socketConnector()

            serverStatus[id].c = connected;
        });

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Connecting to loginserver database...");

        let cfg = connectorConfig["ls"];

        if (cfg && cfg.dbName && cfg.dbPort && cfg.dbUsername && cfg.dbPassword && cfg.dbTableColumns && cfg.dbTableColumns.accounts && cfg.dbTableColumns.gameservers) {

            serverStatus["ls"] = {};

            await serverConnector.CONNECT_SERVER("ls");
            await new Promise((resolve) => {

                const interval = setInterval(() => {

                    if (serverStatus["ls"].v !== undefined && serverStatus["ls"].c !== undefined) {

                        clearInterval(interval);
                        resolve(true);
                    }
                }, 250);
            });

            console.log(dateTime() + " |");
            console.log(dateTime() + " | Connecting to gameserver(s) database...");

            if (serverStatus["ls"].v === true && serverStatus["ls"].c === true) {

                for (const id of await serverConnector.GET_IDS()) {

                    if (((/^\b([1-9]|[1-9][0-9]|1[01][0-9]|12[0-7])\b$/).test(id) && serverStatus[id] === undefined)) {

                        cfg = connectorConfig[id];

                        if (cfg && cfg.rewardId && cfg.dbName && cfg.dbIPAddress && cfg.dbPort && cfg.dbUsername && cfg.dbPassword && cfg.dbTableColumns && cfg.dbTableColumns.characters && cfg.dbTableColumns.items) {

                            serverStatus[id] = {};
                            await serverConnector.CONNECT_SERVER(id);
                        }
                    }
                    else
                        console.log(dateTime() + " | Server `" + id + "` improper configuration (ignored)");
                };
            }
        }
        else {

            console.log(dateTime() + " | Server `ls` improper configuration (fail)");
            process.end();
        }

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Connecting to service...");


    }
    catch (error) {

        console.log("fdg")

        if (error.sqlMessage)
            console.log(dateTime() + " | " + error.sqlMessage);
        else if (error.message)
            console.log(dateTime() + " | " + error.message);
        else
            console.log(dateTime() + " | " + error);

        // process.exit()
    }
}

client();
