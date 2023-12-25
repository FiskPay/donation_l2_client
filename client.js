"use strict";

const { io } = require("socket.io-client");
const Connector = require("./connector.js");
const path = require("node:path");
const fs = require("node:fs");

const { emit: originalEmit } = process;

function suppresser(event, error) {
    return event === 'warning' && error.name === 'ExperimentalWarning'
        ? false
        : originalEmit.apply(process, arguments);
}

process.emit = suppresser;

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

    try {

        console.log(dateTime() + " | -------------------------------------------");
        console.log(dateTime() + " | Private Lineage2 server, blockchain support");
        console.log(dateTime() + " | Learn more about our project at fiskpay.com");
        console.log(dateTime() + " | -------------------------------------------");
        console.log(dateTime() + " | Fetching remote IP address...");

        const remoteIPAddress = (await (await fetch("https://api.ipify.org/?format=json")).json()).ip;
        const msgObject = { "step": null, "subject": null, "type": null, "from": null, "to": null, "data": {} };
        const currentDir = (process.pkg && process.pkg.entrypoint) ? (".") : (path.dirname(process.argv[1]));
        const config = JSON.parse(fs.readFileSync(path.join(currentDir, ".config"), { flag: "r", encoding: "utf8" }));
        const tokenSymbol = "LINK";

        let serverStatus = {};
        let gsBalance, connector, wsClient, gsID;

        console.log(dateTime() + " | Remote IP address: " + remoteIPAddress);

        connector = new Connector(config, remoteIPAddress);
        connector.on("serverUpdate", async (id, connected) => {

            if (connected) {

                if (serverStatus[id].v === undefined)
                    serverStatus[id].v = await connector.VALIDATE_SERVER(id);

                if (serverStatus[id].v === true)
                    console.log(dateTime() + " | Server `" + id + "` database connection established");
                else if (await connector.DISCONNECT_SERVER(id))
                    console.log(dateTime() + " | Server `" + id + "` database validation failed");

                //update panel gameservers
            }
            else {

                if (serverStatus[id].v !== false)
                    setTimeout(async () => { await connector.CONNECT_SERVER(id); }, 10000);

                if (serverStatus[id].c !== false)
                    console.log(dateTime() + " | Server `" + id + "` database connection failed");

                //update panel empty
            }

            serverStatus[id].c = connected;
        });

        console.log(dateTime() + " | Connecting to servers...");

        for (let key in config) {

            if (!(((/^\b([1-9]|[1-9][0-9]|1[01][0-9]|12[0-7])\b$/).test(key) || key == "ls") && serverStatus[key] === undefined))
                continue;

            const cfg = config[key];

            if (key == "ls") {

                if (!(cfg.dbName && cfg.dbPort && cfg.dbUsername && cfg.dbPassword && cfg.dbTableColumns && cfg.dbTableColumns.accounts && cfg.dbTableColumns.gameservers))
                    continue;
            }
            else {

                if (!(cfg.rewardId && cfg.dbName && cfg.dbIPAddress && cfg.dbPort && cfg.dbUsername && cfg.dbPassword && cfg.dbTableColumns && cfg.dbTableColumns.characters && cfg.dbTableColumns.items))
                    continue;
            }

            serverStatus[key] = {};
            await connector.CONNECT_SERVER(key);
        }

        // await connector.VALIDATE_DATABASE();

        // gsIDs = await connector.GET_IDS();

        // console.log(gsID)
        /*
                if (await connector.CONNECT_GAME({ "connector": config.GameServerDB.name, "host": "127.0.0.1", "port": config.GameServerDB.port, "user": config.GameServerDB.username, "password": config.GameServerDB.password, "debug": false }))
                    console.log(dateTime() + " | Gameserver connector connected @ 127.0.0.1:" + config.GameServerDB.port);
         
                if (gsID !== false) {
         
                    console.log(dateTime() + " | Gameserver id: " + gsID);
         
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
        else {
        
        console.log(dateTime() + " | Multiple or zero `server_id` records");
        process.exit()
        }
        */
    }
    catch (error) {

        console.log("dfg")

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
