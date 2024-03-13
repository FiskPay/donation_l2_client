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

    console.log(dateTime() + " | ------------------------------------------------------------------------------------ ");
    console.log(dateTime() + " |                      FiskPay blockchain support for L2J servers                      ");
    console.log(dateTime() + " | ------------------------------------------------------------------------------------ ");

    const tokenSymbol = "USDT";// USDT LINK

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Fetching remote IP address...");

    const remoteIPAddress = (await (await fetch("https://api.fiskpay.com/ip/")).json()).ip;

    console.log(dateTime() + " | Remote IP address: " + remoteIPAddress);

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Fetching configuration file...");

    const configFile = path.join((process.pkg && process.pkg.entrypoint) ? (".") : (path.dirname(process.argv[1])), ".config");
    const connectorConfig = JSON.parse(fs.readFileSync(configFile, { flag: "r", encoding: "utf8" }));

    console.log(dateTime() + " | Configuration file: " + configFile);

    let serversStatus = {};
    let onlineServers = [];

    let updateServerTimeout;

    const serverConnector = new Connector(connectorConfig, remoteIPAddress);
    const socketConnector = io("wss://ds.fiskpay.com:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity });
    //const socketConnector = io("ws://127.0.0.1:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity });

    serverConnector.on("updateServer", async (id, connected) => {

        if (connected) {

            if (typeof serversStatus[id].v == "undefined")
                serversStatus[id].v = await serverConnector.VALIDATE_SERVER(id);

            if (serversStatus[id].v === true) {

                if (id != "ls") {

                    let refund = 0;
                    let balance = 0
                    let ids = 0;

                    serversStatus[id].i = setInterval(() => {

                        if (serversStatus[id].c === true) {

                            (refund >= 3) ? (async () => { refund = 0; await serverConnector.REFUND_CHARACTERS(id); }) : (refund++);
                            (balance >= 1) ? (async () => { balance = 0; await serverConnector.UPDATE_GAMESERVER_BALANCE(id); }) : (balance++);
                            (ids >= 15) ? (async () => { ids = 0; await serverConnector.UPDATE_IDS(id); }) : (ids++);
                        }
                    }, 10000);
                }

                console.log(dateTime() + " | Server `" + id + "` database connection established");
            }
            else if (await serverConnector.DISCONNECT_SERVER(id))
                console.log(dateTime() + " | Server `" + id + "` database validation failed");
        }
        else {

            if (serversStatus[id].c !== false) {

                if (typeof serversStatus[id].i != "undefined") {

                    clearInterval(serversStatus[id].i);
                    delete serversStatus[id].i;
                }

                console.log(dateTime() + " | Server `" + id + "` database connection failed");
            }

            if (serversStatus[id].v !== false)
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
            }, 50)
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

        socketConnector.emit("login", { "symbol": tokenSymbol, "wallet": connectorConfig["client"].walletAddress, "password": connectorConfig["client"].password, "servers": onlineServers }, (responseObject) => {

            if (responseObject.fail) {

                console.log(dateTime() + " | " + responseObject.fail);
                process.exit()
            }

            console.log(dateTime() + " | Connection to service established");
            console.log(dateTime() + " |");
        });
    }).on("disconnect", () => {

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Service temporary unavailable");
    }).on("logDeposit", async (txHash, from, symbol, amount, server, character) => {

        if (typeof serversStatus[server] == "undefined" || serversStatus[server].c !== true)
            console.log(dateTime() + " | You must manually reward character " + character + " with " + amount + " tokens. Server `" + server + "` database currently unavailable");
        else if (await serverConnector.LOG_DEPOSIT(txHash, from, amount, server, character) === true)
            console.log(dateTime() + " | Deposit: " + amount + " " + symbol + ", from " + from + ", to " + character + ", server `" + server + "`");
        else
            console.log(dateTime() + " | You must manually reward character " + character + " with " + amount + " tokens. Server `" + server + "`");
    }).on("logWithdrawal", async (txHash, to, symbol, amount, server, character, refund) => {

        if (typeof serversStatus[server] == "undefined" || serversStatus[server].c !== true)
            console.log(dateTime() + " | You must manually remove " + amount + " tokens from character " + character + ". Server `" + server + "` database currently unavailable");
        else if (await serverConnector.LOG_WITHDRAWAL(txHash, to, amount, server, character, refund) === true)
            console.log(dateTime() + " | Withdrawal: " + amount + " tokens, from " + character + ", to " + to + ", server `" + server + "`");
        else
            console.log(dateTime() + " | You must manually remove " + amount + " tokens from character " + character + ". Server `" + server + "`");
    }).on("request", async (requestObject, requestCB) => {

        if (typeof serversStatus["ls"] == "undefined" || serversStatus["ls"].c !== true)
            requestCB({ "fail": "Login database unavailable" });
        else if (typeof serversStatus[requestObject.id] == "undefined" || serversStatus[requestObject.id].c !== true)
            requestCB({ "fail": "Server `" + requestObject.id + "` database unavailable" });
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

                if (serversStatus[id].v !== undefined) {

                    clearInterval(interval);

                    if (serversStatus[id].v !== true)
                        process.exit();

                    resolve(true);
                }
            }, 250);
        });
    }

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Connecting to login server database...");

    if (!(connectorConfig["ls"] && connectorConfig["ls"].dbName && connectorConfig["ls"].dbPort && connectorConfig["ls"].dbUsername && connectorConfig["ls"].dbPassword && connectorConfig["ls"].dbTableColumns && connectorConfig["ls"].dbTableColumns.accounts && connectorConfig["ls"].dbTableColumns.gameservers)) {

        console.log(dateTime() + " | Server `ls` improper configuration");
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

            console.log(dateTime() + " | Server `" + id + "` improper configuration");
            process.exit();
        }

        await connectToServer(id);
    }

    console.log(dateTime() + " |");
    console.log(dateTime() + " | Connecting to service...");

    socketConnector.connect();
})();
