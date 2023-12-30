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


/*
 
            await connector.REFUND_EXPIRED();
       
            gsBalance = await connector.GET_GAMESERVER_BALANCE();
 
            console.log(dateTime() + " | Gameserver balance: " + gsBalance);
 
            setInterval(async () => {
 
                const prevBalance = gsBalance;
 
                await connector.UPDATE_LOGINSERVER_DATA(gsID);
 
                gsBalance = await connector.GET_GAMESERVER_BALANCE();
 
                const delta = Number(gsBalance) - Number(prevBalance);
 
                if (delta != 0)
                    console.log(dateTime() + " | Gameserver balance : " + gsBalance + " (" + prevBalance + String((delta > 0) ? ("+" + delta) : (delta)) + "=" + gsBalance + ")");
            }, 2500);
 
            console.log(dateTime() + " | Connecting to service...");

                    wsClient = io("wss://donation.fiskpay.com:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity });
//wsClient = io("ws://127.0.0.1:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity });
wsClient.on("connect", () => {

    wsClient.once("connect_error", () => {

        console.log(dateTime() + " | Client will reconnect automatically");
        console.log(dateTime() + " | Do not close the client");
    });

    console.log(dateTime() + " | Connection to service established");
    wsClient.emit("clientRequest", connector.GET_ADDRESS, connector.GET_HASH, tokenSymbol, gsID);
}).on("disconnect", () => {

    console.log(dateTime() + " | Connection to service dropped");
}).on("accepted", () => {

    console.log(dateTime() + " | Signed in as " + config.SignIn.ethereumAddress);
}).on("failed", () => {

    console.log(dateTime() + " | Ethereum address, password, login connector remote IP address, login connector port combination mismatch");
    process.exit();
}).on("duplicateGS", () => {

    console.log(dateTime() + " | Service already connected to gameserver with \"server_id\" = " + gsID);
    process.exit()
}).on("timeout", () => {

    console.log(dateTime() + " | Timeout received. Reopen your client");
    process.exit()
}).on("msg", async (obj) => {

    if (obj.type == "req") {

        if (obj.step % 2 != 1) { //We received a request (req) that has an even numbered step (i.e. 2,4...).>>>>>>>         >>>>>>>         >>>>>>>         >>>>>>>         THIS MUST NEVER HAPPEN

            console.log(dateTime() + " | Received a even-step message\nMessage: " + JSON.stringify(obj));
        }
        else { //We received a new request (req) from a wsClient or the wsServer.>>         >>>>>>>         >>>>>>>         >>>>>>>         >>>>>>>         >>>>>>>         MAY OR MAY NOT EMIT a response (res)

            let emit = false;
            let res = JSON.parse(JSON.stringify(obj));
            res.type = "res";
            res.data = {};

            if (obj.subject == "getAccs" && obj.step == 1) {

                emit = true;
                res.data.accounts = await connector.GET_ACCOUNTS(obj.data.ethAddress);
            }
            else if (obj.subject == "addAcc" && obj.step == 1) {

                emit = true;

                if (await connector.VERIFY_PASSWORD(obj.data.username, obj.data.password))
                    res.data.added = await connector.ADD_ADDRESS(obj.data.username, obj.data.ethAddress);
                else
                    res.data.added = false;
            }
            else if (obj.subject == "removeAcc" && obj.step == 1) {

                emit = true;

                if (await connector.VERIFY_PASSWORD(obj.data.username, obj.data.password))
                    res.data.removed = await connector.REMOVE_ADDRESS(obj.data.username, obj.data.ethAddress);
                else
                    res.data.removed = false;
            }
            else if (obj.subject == "getChars" && obj.step == 1) {

                emit = true;
                res.data.characters = await connector.GET_CHARACTERS(obj.data.username);
            }
            else if (obj.subject == "getCharBalance" && obj.step == 1) {

                emit = true;
                res.data.balance = await connector.GET_CHARACTER_BALANCE(obj.data.character);
            }
            else if (obj.subject == "newWithdraw" && obj.step == 1) {

                const trueAmount = await connector.GET_CHARACTER_BALANCE(obj.data.character);

                if (trueAmount === false || obj.data.amount > trueAmount) {

                    emit = true;
                    res.data.failed = true;
                    res.data.failReason = "Character insufficient balance";
                }
                else {

                    let req = JSON.parse(JSON.stringify(msgObject));

                    req.step = 1;
                    req.subject = "newWithdraw";
                    req.type = "req";
                    req.from = obj.to;
                    req.to = "srv";
                    req.data.panel = obj.from;
                    req.data.from = obj.data.from;
                    req.data.to = obj.data.walletAddress;
                    req.data.symbol = tokenSymbol;
                    req.data.amount = obj.data.amount;
                    req.data.server = gsID;
                    req.data.character = obj.data.character;
                    req.data.signedMessage = obj.data.signedMessage;
                    req.data.refund = await connector.ADD_REFUND_AND_DECREASE_BALANCE(gsID, obj.data.character, obj.data.amount, obj.data.walletAddress);

                    if (req.data.refund !== false)
                        wsClient.emit("msg", req);
                }
            }
            else if (obj.subject == "revertWithdraw" && obj.step == 1) {

                if (await connector.REMOVE_REFUND(gsID, obj.data.character, obj.data.amount, obj.data.refund) !== false)
                    if (await connector.INCREASE_BALANCE(obj.data.character, obj.data.amount) === false)
                        console.log(dateTime() + " | You must reward character " + obj.data.character + " with " + obj.data.amount + " tokens ingame. Automatic token refund failed");
            }
            else if (obj.subject == "logDeposit" && obj.step == 1) {

                if (await connector.INCREASE_BALANCE(obj.data.character, obj.data.amount) === false)
                    console.log(dateTime() + " | You must reward character " + obj.data.character + " with " + obj.data.amount + " tokens ingame. Automatic token increase failed");
                else if (await connector.LOG_DEPOSIT(obj.data.txHash, gsID, obj.data.character, obj.data.from, obj.data.symbol, obj.data.amount) !== false)
                    console.log(dateTime() + " | Deposit from address " + obj.data.from + " to character " + obj.data.character + " (" + obj.data.amount + " " + obj.data.symbol + ")");
            }
            else if (obj.subject == "logWithdrawal" && obj.step == 1) {

                if (await connector.REMOVE_REFUND(gsID, obj.data.character, obj.data.amount, obj.data.refund) === false)
                    console.log(dateTime() + " | You must remove " + obj.data.amount + " tokens from character " + obj.data.character + " ingame. Automatic token decrease failed");
                else if (await connector.LOG_WITHDRAWAL(obj.data.txHash, gsID, obj.data.character, obj.data.to, obj.data.symbol, obj.data.amount) !== false)
                    console.log(dateTime() + " | Withdrawal from character " + obj.data.character + " to address " + obj.data.to + " (" + obj.data.amount + " " + obj.data.symbol + ")");
            }
            else if (obj.subject == "panelUpdate" && obj.step == 1) {

                if (obj.data.disconnect)
                    console.log(dateTime() + " | Panel disconnected (" + obj.data.panelID + ")");
                else
                    console.log(dateTime() + " | Panel connected (" + obj.data.panelID + ")");
            }
            else if (obj.subject == "getGsBalance" && obj.step == 1) {

                emit = true;
                res.data.balance = gsBalance;
            }
            else if (obj.subject == "getLsData" && obj.step == 1) {

                emit = true;

                const tmp = await connector.GET_LOGINSERVER_DATA(gsID);
                res.data.balance = tmp.balance;
                res.data.nChars = tmp.nChars;
            }

            if (emit) {

                res.step++;
                wsClient.emit("msg", res);
            }
        }

    }
}).on("error", (e) => { console.log(e) });
            wsClient.connect();
            
}
*/


const client = async () => {

    console.log(dateTime() + " | ------------------------------------------------------------------------------------");
    console.log(dateTime() + " |                   Fiskpay blockchain support for Lineage2 servers                   ");
    console.log(dateTime() + " | ------------------------------------------------------------------------------------");

    try {

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Fetching remote IP address...");

        const remoteIPAddress = (await (await fetch("https://api.ipify.org/?format=json")).json()).ip;

        console.log(dateTime() + " | Remote IP address: " + remoteIPAddress);

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Fetching configuration file...");

        const configFile = path.join((process.pkg && process.pkg.entrypoint) ? (".") : (path.dirname(process.argv[1])), ".config");
        const connectorConfig = JSON.parse(fs.readFileSync(configFile, { flag: "r", encoding: "utf8" }));

        console.log(dateTime() + " | Configuration file: " + configFile);

        const serverConnector = new Connector(connectorConfig, remoteIPAddress);
        const socketConnector = io("ws://127.0.0.1:42099", { "autoConnect": false, "reconnection": true, "reconnectionDelay": 5000, "reconnectionAttempts": Infinity }); // "wss://donation.fiskpay.com:42099" "ws://127.0.0.1:42099"

        let serversStatus = {};
        let chainStatus = false;

        serverConnector.on("updateServer", async (id, status) => {

            if (status) {

                if (serversStatus[id].v === undefined)
                    serversStatus[id].v = await serverConnector.VALIDATE_SERVER(id);

                if (serversStatus[id].v === true)
                    console.log(dateTime() + " | Server `" + id + "` database connection established");
                else if (await serverConnector.DISCONNECT_SERVER(id))
                    console.log(dateTime() + " | Server `" + id + "` database validation failed");
            }
            else {

                if (serversStatus[id].v !== false)
                    setTimeout(async () => { await serverConnector.CONNECT_SERVER(id); }, 10000);

                if (serversStatus[id].c !== false)
                    console.log(dateTime() + " | Server `" + id + "` database connection failed");
            }

            serversStatus[id].c = status;

            socketConnector.volatile.emit("serversStatus", serversStatus);
        });

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Connecting to loginserver database...");

        if (!(connectorConfig["ls"] && connectorConfig["ls"].dbName && connectorConfig["ls"].dbPort && connectorConfig["ls"].dbUsername && connectorConfig["ls"].dbPassword && connectorConfig["ls"].dbTableColumns && connectorConfig["ls"].dbTableColumns.accounts && connectorConfig["ls"].dbTableColumns.gameservers)) {

            console.log(dateTime() + " | Server `ls` improper configuration");
            process.exit();
        }

        await new Promise(async (resolve) => {

            serversStatus["ls"] = {};
            await serverConnector.CONNECT_SERVER("ls");

            const interval = setInterval(() => {

                if (serversStatus["ls"].v !== undefined) {

                    clearInterval(interval);

                    if (serversStatus["ls"].v !== true)
                        process.exit();

                    resolve(true);
                }
            }, 250);
        });

        console.log(dateTime() + " |");
        console.log(dateTime() + " | Connecting to gameserver(s) database...");

        for (const id of await serverConnector.GET_IDS()) {

            if (!(connectorConfig[id] && connectorConfig[id].rewardId && connectorConfig[id].dbName && connectorConfig[id].dbIPAddress && connectorConfig[id].dbPort && connectorConfig[id].dbUsername && connectorConfig[id].dbPassword && connectorConfig[id].dbTableColumns && connectorConfig[id].dbTableColumns.characters && connectorConfig[id].dbTableColumns.items)) {

                console.log(dateTime() + " | Server `" + id + "` improper configuration");
                process.exit();
            }

            await new Promise(async (resolve) => {

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
        console.log(dateTime() + " | Connecting to fiskpay service...");

        const msgObject = { "step": null, "subject": null, "type": null, "from": null, "to": null, "data": {} };
        const tokenSymbol = "LINK";

        const connect = () => {

            socketConnector.off();

            socketConnector.once("connect", () => {

                socketConnector.emit("login", [tokenSymbol, connectorConfig["client"].walletAddress, connectorConfig["client"].password, serversStatus], (result, status) => {

                    chainStatus = status;

                    if (result !== true) {

                        console.log(dateTime() + " | " + result);
                        process.exit()
                    }

                    socketConnector.on("disconnect", () => {

                        console.log(dateTime() + " |");
                        console.log(dateTime() + " | Connection to service lost");

                        connect();
                    }).on("chainStatus", (status) => {

                        chainStatus = status;
                    });

                    console.log(dateTime() + " | Connection to service established");
                    console.log(dateTime() + " |");
























                });
            });
        }

        connect();
        socketConnector.connect();
    }
    catch (error) {

        console.log("fdg")

        if (error.sqlMessage)
            console.log(dateTime() + " | " + error.sqlMessage);
        else if (error.message)
            console.log(dateTime() + " | " + error.message);
        else
            console.log(dateTime() + " | " + error);

        process.exit();
    }
}

client();
