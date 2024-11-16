"use strict";

const { io } = require("socket.io-client");
const connector = require("./connector.js");
const path = require("node:path");
const fs = require("node:fs");

(async () => {

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

    console.log(dateTime() + " | ----------------------------------------------------------------------------------- ");
    console.log(dateTime() + " |                          L2J Blockchain Support by FiskPay                          ");
    console.log(dateTime() + " | ----------------------------------------------------------------------------------- ");

    const tokenSymbol = "USDT";// USDT LINK

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Supporting " + tokenSymbol + " token on Polygon network");
    console.log(dateTime() + " | Complied using Node version " + process.versions.node);

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Fetching remote IP address...");

    const remoteIPAddress = (await (await fetch("https://api.fiskpay.com/ip/")).json()).ip;

    console.log(dateTime() + " | Remote IP address: " + remoteIPAddress);

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Fetching configuration file...");

    const configFile = path.join((process.pkg && process.pkg.entrypoint) ? (".") : (path.dirname(process.argv[1])), "fp.config");
    const connectorConfig = JSON.parse(fs.readFileSync(configFile, { flag: "r", encoding: "utf8" }));

    console.log(dateTime() + " | Configuration file: " + configFile);

    let serversStatus = {};
    let onlineServers = [];

    let updateServerTimeout;

    const serverConnector = new connector(connectorConfig, remoteIPAddress);
    //const socketConnector = io("wss://ds.fiskpay.com:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity });
    const socketConnector = io("ws://127.0.0.1:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity });

    const serverName = (id) => {

        switch (String(id)) {

            case "1":
                return "Bartz";
            case "2":
                return "Sieghardt";
            case "3":
                return "Kain";
            case "4":
                return "Lionna";
            case "5":
                return "Erica";
            case "6":
                return "Gustin";
            case "7":
                return "Devianne";
            case "8":
                return "Hindemith";
            case "9":
                return "Teon";
            case "10":
                return "Franz";
            case "11":
                return "Luna";
            case "12":
                return "Kastien";
            case "13":
                return "Airin";
            case "14":
                return "Staris";
            case "15":
                return "Ceriel";
            case "16":
                return "Fehyshar";
            case "17":
                return "Elhwynna";
            case "18":
                return "Ellikia";
            case "19":
                return "Shikken";
            case "20":
                return "Scryde";
            case "21":
                return "Frikios";
            case "22":
                return "Ophylia";
            case "23":
                return "Shakdun";
            case "24":
                return "Tarziph";
            case "25":
                return "Aria";
            default:
                return "Unknown";
        }
    }

    serverConnector.on("updateServer", async (id, connected) => {

        if (typeof serversStatus[id].i != "undefined") {

            clearInterval(serversStatus[id].i);
            delete serversStatus[id].i;
        }

        if (connected) {

            if (typeof serversStatus[id].v == "undefined")
                serversStatus[id].v = await serverConnector.VALIDATE_SERVER(id);

            if (serversStatus[id].v === true) {

                if (id != "ls") {

                    await serverConnector.REFUND_CHARACTERS(id);
                    await serverConnector.UPDATE_GAMESERVER_BALANCE(id);

                    let counter = 1;

                    serversStatus[id].i = setInterval(async () => {

                        if (serversStatus[id].c === true) {

                            counter++;

                            if (counter % 3 == 0)
                                await serverConnector.REFUND_CHARACTERS(id);

                            if (counter % 1 == 0)
                                await serverConnector.UPDATE_GAMESERVER_BALANCE(id);

                            if (counter >= 10000000001)
                                counter = 1;
                        }
                    }, 10000);

                    console.log(dateTime() + " | Connection to game server " + serverName(id) + " database established");
                }
                else
                    console.log(dateTime() + " | Connection to login server database established");
            }
            else if (await serverConnector.DISCONNECT_SERVER(id)) {

                if (id != "ls")
                    console.log(dateTime() + " | Game server " + serverName(id) + " database validation failed");
                else
                    console.log(dateTime() + " | Login server database validation failed");

                process.exit();
            }
        }
        else {

            if (serversStatus[id].c !== false) {

                if (id != "ls")
                    console.log(dateTime() + " | Connection to game server " + serverName(id) + " database failed");
                else
                    console.log(dateTime() + " | Connection to login server database failed");
            }

            if (typeof serversStatus[id].v == "undefined" || serversStatus[id].v === true)
                setTimeout(async () => { serverConnector.CONNECT_SERVER(id); }, 10000);
        }

        if (serversStatus[id].c !== (serversStatus[id].c = connected)) {

            clearTimeout(updateServerTimeout);

            let tmpServers = [];

            if (serversStatus["ls"].v === true && serversStatus["ls"].c === true) {

                for (let server in serversStatus) {

                    if (server !== "ls" && serversStatus[server].v === true && serversStatus[server].c === true)
                        tmpServers.push(server);
                }
            }

            onlineServers = tmpServers;

            updateServerTimeout = setTimeout(() => {

                socketConnector.volatile.emit("onlineServers", onlineServers);
            }, 500)
        }
    }).on("error", (error) => {

        console.log(dateTime() + " | ------------------------------------ ERROR START -----------------------------------")

        if (error.sql && error.code && error.errno && error.sqlState) {

            console.log(dateTime() + " | Query: " + error.sql);
            console.log(dateTime() + " | Code: " + error.code);
            console.log(dateTime() + " | Number: " + error.errno);
            console.log(dateTime() + " | State: " + error.sqlState);
        }
        else
            console.log(dateTime() + " | " + error);

        console.log(dateTime() + " | ------------------------------------- ERROR END ------------------------------------")
    });

    socketConnector.on("connect", () => {

        socketConnector.emit("login", { "symbol": tokenSymbol, "wallet": connectorConfig["client"].walletAddress, "password": connectorConfig["client"].password, "servers": onlineServers }, async (responseObject) => {

            if (responseObject.fail) {

                console.log(dateTime() + " | " + responseObject.fail);
                console.log(dateTime() + " |");
                console.log(dateTime() + " | ----------------------------------------------------------------------------------- ");
                process.exit();
            }

            console.log(dateTime() + " | Connection to service established");
            console.log(dateTime() + " |");
            console.log(dateTime() + " | ----------------------------------------------------------------------------------- ");
        });
    }).on("disconnect", () => {

        console.log(dateTime() + " | Service temporary unavailable");
    }).on("logDeposit", async (txHash, from, symbol, amount, server, character) => {

        if (typeof serversStatus[server] == "undefined" || serversStatus[server].c !== true)
            console.log(dateTime() + " | You must manually reward character " + character + " with " + amount + " tokens. Game server " + serverName(server) + " database currently unavailable");
        else if (await serverConnector.LOG_DEPOSIT(txHash, from, amount, server, character) === true)
            console.log(dateTime() + " | " + serverName(server) + ": " + from + " -> " + character + " = " + amount + " " + symbol);
        else
            console.log(dateTime() + " | You must manually reward character " + character + " with " + amount + " tokens on game server " + serverName(server));
    }).on("logWithdrawal", async (txHash, to, symbol, amount, server, character, refund) => {

        if (typeof serversStatus[server] == "undefined" || serversStatus[server].c !== true)
            console.log(dateTime() + " | You must manually remove " + amount + " tokens from character " + character + ". Server " + serverName(server) + " database currently unavailable");
        else if (await serverConnector.LOG_WITHDRAWAL(txHash, to, amount, server, character, refund) === true)
            console.log(dateTime() + " | " + serverName(server) + ": " + character + " -> " + to + " = " + amount + " " + symbol);
        else
            console.log(dateTime() + " | You must manually remove " + amount + " tokens from character " + character + " on game server " + serverName(server));
    }).on("request", async (requestObject, requestCB) => {

        if (typeof serversStatus["ls"] == "undefined" || serversStatus["ls"].c !== true)
            requestCB({ "fail": "Login server database unavailable" });
        else if (typeof serversStatus[requestObject.id] == "undefined" || serversStatus[requestObject.id].c !== true)
            requestCB({ "fail": "Game server " + serverName(requestObject.id) + " database unavailable" });
        else {

            const data = requestObject.data;

            switch (requestObject.subject) {

                case "getAccs": {

                    if (typeof data.walletAddress == "undefined")
                        requestCB({ "fail": "walletAddress undefined" });
                    else
                        requestCB(await serverConnector.GET_ACCOUNTS(data.walletAddress));

                    break;
                }
                case "getChars": {

                    if (typeof data.username == "undefined")
                        requestCB({ "fail": "username undefined" });
                    else
                        requestCB(await serverConnector.GET_CHARACTERS(requestObject.id, data.username));

                    break;
                }
                case "getCharBal": {

                    if (typeof data.character == "undefined")
                        requestCB({ "fail": "character undefined" });
                    else
                        requestCB(await serverConnector.GET_CHARACTER_BALANCE(requestObject.id, data.character));

                    break;
                }
                case "getClientBal": {

                    requestCB(await serverConnector.GET_TOTAL_CLIENT_BALANCE());

                    break;
                }
                case "addAcc": {

                    if (typeof data.username == "undefined")
                        requestCB({ "fail": "username undefined" });
                    else if (typeof data.password == "undefined")
                        requestCB({ "fail": "password undefined" });
                    else if (typeof data.walletAddress == "undefined")
                        requestCB({ "fail": "walletAddress undefined" });
                    else
                        requestCB(await serverConnector.ADD_ACCOUNT(data.username, data.password, data.walletAddress));

                    break;
                }
                case "removeAcc": {

                    if (typeof data.username == "undefined")
                        requestCB({ "fail": "username undefined" });
                    else if (typeof data.password == "undefined")
                        requestCB({ "fail": "password undefined" });
                    else if (typeof data.walletAddress == "undefined")
                        requestCB({ "fail": "walletAddress undefined" });
                    else
                        requestCB(await serverConnector.REMOVE_ACCOUNT(data.username, data.password, data.walletAddress));

                    break;
                }
                case "isOffline": {

                    if (typeof data.character == "undefined")
                        requestCB({ "fail": "character undefined" });
                    else
                        requestCB(await serverConnector.CHECK_IF_CHARACTER_OFFLINE(requestObject.id, data.character));

                    break;
                }
                case "doWithdraw": {

                    requestCB(await serverConnector.CREATE_REFUND(data.address, data.amount, requestObject.id, data.character, data.refund));

                    break;
                }
                default: {

                    requestCB({ "fail": "Subject unknown" });

                    break;
                }
            }
        }
    });

    const connectToServer = async (id) => {

        return await new Promise(async (resolve) => {

            serversStatus[id] = {};
            await serverConnector.CONNECT_SERVER(id);

            const interval = setInterval(() => {

                if (serversStatus[id].c === true && serversStatus[id].v === true) {

                    clearInterval(interval);
                    resolve(true);
                }
            }, 250);
        });
    }

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Connecting to login server database...");

    if (!(connectorConfig["ls"] && connectorConfig["ls"].dbName && connectorConfig["ls"].dbPort && connectorConfig["ls"].dbUsername && connectorConfig["ls"].dbPassword && connectorConfig["ls"].dbTableColumns && connectorConfig["ls"].dbTableColumns.accounts && connectorConfig["ls"].dbTableColumns.gameservers)) {

        console.log(dateTime() + " | Login server improper configuration");
        process.exit();
    }

    await connectToServer("ls");

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Connecting to game server(s) database...");

    const serverIDs = await serverConnector.GET_IDS();

    if (serverIDs === false) {

        console.log(dateTime() + " | Could not get the game server(s) id list from login server database");
        process.exit();
    }

    for (const id of serverIDs) {

        if (!(connectorConfig[id] && connectorConfig[id].rewardTypeId && connectorConfig[id].dbName && connectorConfig[id].dbIPAddress && connectorConfig[id].dbPort && connectorConfig[id].dbUsername && connectorConfig[id].dbPassword && connectorConfig[id].dbTableColumns && connectorConfig[id].dbTableColumns.characters && connectorConfig[id].dbTableColumns.items)) {

            console.log(dateTime() + " | Game server " + serverName(id) + " improper configuration");
            process.exit();
        }

        await connectToServer(id);
    }

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Connecting to service...");

    socketConnector.connect();
})();