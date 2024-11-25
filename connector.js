const mysql = require("mysql2/promise");
const EventEmitter = require("node:events");
const crypto = require("node:crypto");

let encAlgo;

const algo = [

    (pass) => {

        return crypto.createHash("sha1").update(pass).digest('base64');
    },
    (pass) => {

        return crypto.createHash("md5").update(pass).digest('base64');
    },
    (pass) => {

        return crypto.createHash("sha256").update(pass).digest('base64');
    },
    (pass) => {

        let key = [];
        let dst = [];
        let i = 0;
        let nBytes = pass.length;

        while (i < nBytes) {

            i++;

            key[i] = pass.charCodeAt(i - 1);
            dst[i] = key[i];
        }

        for (let i = 1; i <= 16; i++) {

            if (!key[i])
                key[i] = 0;

            if (!dst[i])
                dst[i] = 0;
        }

        let rslt = key[1] + key[2] * 256 + key[3] * 65536 + key[4] * 16777216;
        let one = rslt * 213119 + 2529077;

        one = one - Math.floor(one / 4294967296) * 4294967296;
        rslt = key[5] + key[6] * 256 + key[7] * 65536 + key[8] * 16777216;

        let two = rslt * 213247 + 2529089;

        two = two - Math.floor(two / 4294967296) * 4294967296;
        rslt = key[9] + key[10] * 256 + key[11] * 65536 + key[12] * 16777216;

        let three = rslt * 213203 + 2529589;

        three = three - Math.floor(three / 4294967296) * 4294967296;
        rslt = key[13] + key[14] * 256 + key[15] * 65536 + key[16] * 16777216;

        let four = rslt * 213821 + 2529997;

        four = four - Math.floor(four / 4294967296) * 4294967296;

        key[1] = one & 0xFF;
        key[2] = (one >> 8) & 0xFF;
        key[3] = (one >> 16) & 0xFF;
        key[4] = (one >> 24) & 0xFF;
        key[5] = two & 0xFF;
        key[6] = (two >> 8) & 0xFF;
        key[7] = (two >> 16) & 0xFF;
        key[8] = (two >> 24) & 0xFF;
        key[9] = three & 0xFF;
        key[10] = (three >> 8) & 0xFF;
        key[11] = (three >> 16) & 0xFF;
        key[12] = (three >> 24) & 0xFF;
        key[13] = four & 0xFF;
        key[14] = (four >> 8) & 0xFF;
        key[15] = (four >> 16) & 0xFF;
        key[16] = (four >> 24) & 0xFF;
        dst[1] = dst[1] ^ key[1];

        i = 1;

        while (i < 16) {
            i++;

            dst[i] = dst[i] ^ dst[i - 1] ^ key[i];
        }

        i = 0;

        while (i < 16) {

            i++;
            if (dst[i] == 0)
                dst[i] = 102;
        }

        let encrypt = "0x";

        i = 0;

        while (i < 16) {

            i++;

            if (dst[i] < 16)
                encrypt = encrypt + "0" + dst[i].toString(16);
            else
                encrypt = encrypt + dst[i].toString(16);
        }

        return encrypt;
    },
    (pass) => {

        const EncryptMD5 = (originalPassword) => { return Array.from(crypto.createHash("md5").update(originalPassword).digest()).map((byte) => byte.toString(16).padStart(2, "0")).join(""); };
        const md5Password = Array.from(pass);

        let s = (EncryptMD5(pass) + EncryptMD5(pass)).split("");
        let j = 0;

        for (let i = 0; i < s.length; i++) {

            if (j >= pass.length)
                j = 0;

            const calcu = s[i].charCodeAt(0) ^ md5Password[j].charCodeAt(0);

            s[i] = String.fromCharCode(calcu);

            j++;
        }

        return EncryptMD5(s.join(""));
    }
];

const validatePassword = (test, target) => {

    if (encAlgo == undefined) {

        for (let i = 0; i < algo.length; i++) {

            if (algo[i](test) == target) {

                encAlgo = i;

                return true;
            }
        }

        return false;
    }
    else {

        return (algo[encAlgo](test) == target)
    }
}

class Connector extends EventEmitter {

    #config;
    #remoteIPAddress;
    #connections = class { this = []; };
    #serverData = {};

    constructor(config, remoteIPAddress) {

        super();

        this.#config = config;
        this.#remoteIPAddress = remoteIPAddress;
    }

    CONNECT_SERVER = async (id) => {//C

        return await new Promise(async (resolve) => {

            try {

                this.#connections[id] = mysql.createPool({

                    "database": this.#config[id].dbName,
                    "host": ((id == "ls" || this.#config[id].dbIPAddress == this.#remoteIPAddress) ? ("127.0.0.1") : (this.#config[id].dbIPAddress)),
                    "port": this.#config[id].dbPort,
                    "user": this.#config[id].dbUsername,
                    "password": this.#config[id].dbPassword,
                    "waitForConnections": true,
                    "connectionLimit": ((id == "ls") ? (12 + 1) : (4 + 1)),
                    "maxIdle": ((id == "ls") ? (4) : (2)),
                    "idleTimeout": 60000,
                    "queueLimit": 0,
                    "enableKeepAlive": true,
                    "keepAliveInitialDelay": 0
                });

                const connection = await this.#connections[id].getConnection();
                connection.on("error", () => {

                    clearInterval(this.#serverData[id].interval);

                    this.emit("updateServer", id, false);
                });

                if (typeof this.#serverData[id] == "undefined") {

                    if (id == "ls")
                        this.#serverData[id] = { "interval": undefined, "tables": undefined };
                    else
                        this.#serverData[id] = { "interval": undefined, "tables": undefined, "rewardId": undefined };
                }

                this.#serverData[id].interval = setInterval(() => { connection.query(`SELECT 1;`); }, 45000);

                this.emit("updateServer", id, true);
            }
            catch (e) {

                this.emit("updateServer", id, false);
            }
            finally {

                resolve(true);
            }
        });
    }

    DISCONNECT_SERVER = async (id) => {//C

        clearInterval(this.#serverData[id].interval);
        await this.#connections[id].end();

        return true;
    }

    VALIDATE_SERVER = async (id) => {//C

        const connection = await this.#connections[id].getConnection();

        let checks = 0;
        let result = false;

        try {

            if (id == "ls") {

                const accountsTable = (await connection.query(`SHOW COLUMNS FROM accounts;`))[0];
                const gameserversTable = (await connection.query(`SHOW COLUMNS FROM gameservers;`))[0];

                const lsConfig = this.#config["ls"].dbTableColumns;

                let addWalletAddressColumn = true;
                let addBalanceColumn = true;

                accountsTable.forEach((column) => {

                    if (column.Field == "wallet_address")
                        addWalletAddressColumn = false;

                    if (column.Field == lsConfig.accounts.accountUsername || column.Field == lsConfig.accounts.accountPassword)
                        checks++;
                });

                gameserversTable.forEach((column) => {

                    if (column.Field == "balance")
                        addBalanceColumn = false;

                    if (column.Field == lsConfig.gameservers.gameserverId)
                        checks++
                });

                if (checks == 3) {

                    if (addWalletAddressColumn)
                        await connection.query(`ALTER TABLE accounts ADD COLUMN wallet_address VARCHAR(42) NOT NULL DEFAULT 'not linked';`);

                    if (addBalanceColumn)
                        await connection.query(`ALTER TABLE gameservers ADD COLUMN balance INT(10) UNSIGNED NOT NULL DEFAULT '0';`);

                    await connection.query(`CREATE TABLE IF NOT EXISTS fiskpay_deposits (server_id INT(11) NOT NULL, transaction_hash VARCHAR(66) NOT NULL, character_name VARCHAR(35) NOT NULL, wallet_address VARCHAR(42) NOT NULL, amount INT(10) UNSIGNED NOT NULL, PRIMARY KEY(transaction_hash)) ENGINE = InnoDB DEFAULT CHARSET = utf8;`);
                    await connection.query(`CREATE TABLE IF NOT EXISTS fiskpay_withdrawals (server_id INT(11) NOT NULL, transaction_hash VARCHAR(66) NOT NULL, character_name VARCHAR(35) NOT NULL, wallet_address VARCHAR(42) NOT NULL, amount INT(10) UNSIGNED NOT NULL, PRIMARY KEY(transaction_hash)) ENGINE = InnoDB DEFAULT CHARSET = utf8;`);
                    await connection.query(`CREATE TABLE IF NOT EXISTS fiskpay_temporary (server_id INT(11) NOT NULL, character_id INT(10) NOT NULL, amount INT(10) UNSIGNED NOT NULL, refund INT(10) UNSIGNED NOT NULL, PRIMARY KEY(server_id, character_id, refund)) ENGINE = InnoDB DEFAULT CHARSET = utf8;`);

                    this.#serverData["ls"].tables = lsConfig;

                    result = true;
                }
            }
            else {

                const charactersTable = (await connection.query(`SHOW COLUMNS FROM characters;`))[0];
                const itemsTable = (await connection.query(`SHOW COLUMNS FROM items;`))[0];

                const gsTables = this.#config[id].dbTableColumns;
                const gsRewardId = this.#config[id].rewardTypeId;

                charactersTable.forEach((column) => {

                    if (column.Field == gsTables.characters.accountUsername || column.Field == gsTables.characters.characterId || column.Field == gsTables.characters.characterName)
                        checks++;
                });

                itemsTable.forEach((column) => {

                    if (column.Field == gsTables.items.characterId || column.Field == gsTables.items.itemId || column.Field == gsTables.items.itemTypeId || column.Field == gsTables.items.itemAmount)
                        checks++
                });

                if (checks == 7) {

                    await connection.query(`CREATE TABLE IF NOT EXISTS reserved_item_ids (item_id INT(10) NOT NULL, PRIMARY KEY(item_id)) ENGINE = InnoDB DEFAULT CHARSET = utf8;`);

                    this.#serverData[id].tables = gsTables;
                    this.#serverData[id].rewardId = gsRewardId;

                    result = true;
                }
            }
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_IDS = async () => {//C

        const connection = await this.#connections["ls"].getConnection();
        const lGameserversGameserverId = this.#serverData["ls"].tables.gameservers.gameserverId;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT ${lGameserversGameserverId} FROM gameservers;`))[0];
            result = temporary.map(key => key[lGameserversGameserverId])
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_TOTAL_CLIENT_BALANCE = async () => {//P

        const connection = await this.#connections["ls"].getConnection();

        let result;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT SUM(balance) AS balance FROM gameservers;`))[0][0];
            result = { "data": (String((temporary.balance != null) ? (temporary.balance) : ("0"))) };
        }
        catch (error) {

            result = { "fail": "GET_TOTAL_CLIENT_BALANCE SQL error" };
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_ACCOUNTS = async (ethAddress) => {//P

        const connection = await this.#connections["ls"].getConnection();
        const lCharactersAccountUsername = this.#serverData["ls"].tables.accounts.accountUsername;

        let result;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT ${lCharactersAccountUsername} FROM accounts WHERE wallet_address = ?;`, [ethAddress]))[0];
            result = { "data": (temporary.map(key => key[lCharactersAccountUsername])) };
        }
        catch (error) {

            result = { "fail": "GET_ACCOUNTS SQL error" };
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    ADD_ACCOUNT = async (username, password, ethAddress) => {//P

        const connection = await this.#connections["ls"].getConnection();
        const lCharactersAccountUsername = this.#serverData["ls"].tables.accounts.accountUsername;
        const lAccountsAccountPassword = this.#serverData["ls"].tables.accounts.accountPassword;

        let result;
        let temporary;

        try {

            await connection.query(`SET autocommit = 0;`);
            await connection.query(`START TRANSACTION;`);

            temporary = (await connection.query(`SELECT ${lAccountsAccountPassword}, wallet_address FROM accounts WHERE ${lCharactersAccountUsername} = ?`, [username]))[0];

            if (temporary.length == 1) {

                const walletAddress = temporary[0].wallet_address;
                const targetPassword = temporary[0][lAccountsAccountPassword];

                if (!validatePassword(password, targetPassword))
                    result = { "fail": "Username - password mismatch" };
                else if (walletAddress != "not linked")
                    result = { "fail": "Account " + username + " already linked to an Ethereum address" };
                else
                    result = { "data": ((await connection.query(`UPDATE accounts SET wallet_address = ? WHERE ${lCharactersAccountUsername} = ? AND wallet_address = 'not linked' AND ${lAccountsAccountPassword} = '${targetPassword}';`, [ethAddress, username]))[0].changedRows == 1) };
            }
            else if (temporary.length == 0)
                result = { "fail": "Username - password mismatch" };
            else
                result = { "fail": "Multiple instances of account " + username + " in db" };
        }
        catch (error) {

            result = { "fail": "ADD_ACCOUNT SQL error" };
            this.emit("error", error);
        }
        finally {

            if (result.data === true)
                await connection.query(`COMMIT;`);
            else
                await connection.query(`ROLLBACK;`);

            connection.release();
            return result;
        }
    }

    REMOVE_ACCOUNT = async (username, password, ethAddress) => {//P

        const connection = await this.#connections["ls"].getConnection();
        const lCharactersAccountUsername = this.#serverData["ls"].tables.accounts.accountUsername;
        const lAccountsAccountPassword = this.#serverData["ls"].tables.accounts.accountPassword;

        let result = false;
        let temporary;

        try {

            await connection.query(`SET autocommit = 0;`);
            await connection.query(`START TRANSACTION;`);

            temporary = (await connection.query(`SELECT ${lAccountsAccountPassword}, wallet_address FROM accounts WHERE ${lCharactersAccountUsername} = ?`, [username]))[0];

            if (temporary.length == 1) {

                const walletAddress = temporary[0].wallet_address;
                const targetPassword = temporary[0][lAccountsAccountPassword];

                if (!validatePassword(password, targetPassword))
                    result = { "fail": "Username - password mismatch" };
                else if (walletAddress != ethAddress)
                    result = { "fail": "Account " + username + " not linked to your Ethereum address" };
                else
                    result = { "data": ((await connection.query(`UPDATE accounts SET wallet_address = 'not linked' WHERE ${lCharactersAccountUsername} = ? AND wallet_address = ? AND ${lAccountsAccountPassword} = '${targetPassword}';`, [username, ethAddress]))[0].changedRows == 1) };
            }
            else if (temporary.length == 0)
                result = { "fail": "Username - password mismatch" };
            else
                result = { "fail": "Multiple instances of account " + username + " in db" };
        }
        catch (error) {

            result = { "fail": "ADD_ACCOUNT SQL error" };
            this.emit("error", error);
        }
        finally {

            if (result.data === true)
                await connection.query(`COMMIT;`);
            else
                await connection.query(`ROLLBACK;`);

            connection.release();
            return result;
        }
    }

    GET_CHARACTERS = async (id, username) => {//P

        const connection = await this.#connections[id].getConnection();
        const lCharactersAccountUsername = this.#serverData[id].tables.characters.accountUsername;
        const lCharactersCharacterName = this.#serverData[id].tables.characters.characterName;

        let result;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT ${lCharactersCharacterName} FROM characters WHERE ${lCharactersAccountUsername} = ?;`, [username]))[0];
            result = { "data": (temporary.map(key => key[lCharactersCharacterName])) };
        }
        catch (error) {

            result = { "fail": "GET_CHARACTERS SQL error" };
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    GET_CHARACTER_BALANCE = async (id, charname) => {//P

        const connection = await this.#connections[id].getConnection();
        const lCharactersCharacterName = this.#serverData[id].tables.characters.characterName;
        const lCharactersCharacterId = this.#serverData[id].tables.characters.characterId;
        const lItemsCharacterId = this.#serverData[id].tables.items.characterId;
        const lItemsItemTypeId = this.#serverData[id].tables.items.itemTypeId;
        const lItemsItemAmount = this.#serverData[id].tables.items.itemAmount;
        const lRewardTypeId = this.#serverData[id].rewardId;

        let result;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT SUM(i.${lItemsItemAmount}) AS balance FROM items AS i, characters AS c WHERE c.${lCharactersCharacterId} = i.${lItemsCharacterId} AND c.${lCharactersCharacterName} = ? AND i.${lItemsItemTypeId} = '${lRewardTypeId}' AND i.loc = 'INVENTORY';`, [charname]))[0][0];
            result = { "data": (String((temporary.balance != null) ? (temporary.balance) : ("0"))) };
        }
        catch (error) {

            result = { "fail": "GET_CHARACTER_BALANCE SQL error" };
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    UPDATE_GAMESERVER_BALANCE = async (id) => {//C

        const connectionLS = await this.#connections["ls"].getConnection();
        const connectionGS = await this.#connections[id].getConnection();
        const lItemsItemTypeId = this.#serverData[id].tables.items.itemTypeId;
        const lItemsItemAmount = this.#serverData[id].tables.items.itemAmount;
        const lGameserversGameserverId = this.#serverData["ls"].tables.gameservers.gameserverId;
        const lRewardTypeId = this.#serverData[id].rewardId;

        let result = false;
        let temporary;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            temporary = (await connectionGS.query(`SELECT SUM(${lItemsItemAmount}) AS balance FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}';`))[0][0];

            const balance = String((temporary.balance != null) ? (temporary.balance) : ("0"));

            result = ((await connectionLS.query(`UPDATE gameservers SET balance = '${balance}' WHERE ${lGameserversGameserverId} = ?;`, [id]))[0].changedRows == 1);
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query(`COMMIT;`);
                await connectionGS.query(`COMMIT;`);
            }
            else {

                await connectionLS.query(`ROLLBACK;`);
                await connectionGS.query(`ROLLBACK;`);
            }

            connectionLS.release();
            connectionGS.release();
            return result;
        }
    }

    CHECK_IF_CHARACTER_OFFLINE = async (id, character) => {//P

        const connection = await this.#connections[id].getConnection();
        const lCharactersCharacterName = this.#serverData[id].tables.characters.characterName;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT online FROM characters WHERE ${lCharactersCharacterName} = ? LIMIT 1;`, [character]))[0];
            result = { "data": (temporary.length == 1 && String(temporary[0].online) != "1") };
        }
        catch (error) {

            result = { "fail": "CHECK_IF_CHARACTER_OFFLINE SQL error" };
            this.emit("error", error);
        }
        finally {

            connection.release();
            return result;
        }
    }

    LOG_DEPOSIT = async (txHash, from, amount, id, character) => {//C

        const connectionLS = await this.#connections["ls"].getConnection();
        const connectionGS = await this.#connections[id].getConnection();
        const lCharactersCharacterName = this.#serverData[id].tables.characters.characterName;
        const lCharactersCharacterId = this.#serverData[id].tables.characters.characterId;
        const lItemsItemId = this.#serverData[id].tables.items.itemId;
        const lItemsCharacterId = this.#serverData[id].tables.items.characterId;
        const lItemsItemTypeId = this.#serverData[id].tables.items.itemTypeId;
        const lItemsItemAmount = this.#serverData[id].tables.items.itemAmount;
        const lRewardTypeId = this.#serverData[id].rewardId;

        let result = false;
        let temporary;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            temporary = (await connectionGS.query(`SELECT ${lCharactersCharacterId} FROM characters WHERE ${lCharactersCharacterName} = ? LIMIT 1;`, [character]))[0][0];

            const charId = temporary[lCharactersCharacterId];

            temporary = (await connectionGS.query(`SELECT ${lItemsItemId} FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND loc = 'INVENTORY' AND ${lItemsCharacterId} = '${charId}' LIMIT 1;`))[0];

            if (temporary.length == 1) {

                const itemId = temporary[0][lItemsItemId];

                if ((await connectionGS.query(`UPDATE items SET ${lItemsItemAmount} = ${lItemsItemAmount} + ? WHERE ${lItemsItemId} = '${itemId}' LIMIT 1;`, [amount]))[0].changedRows == 1) {

                    if ((await connectionLS.query(`INSERT INTO fiskpay_deposits (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);`, [id, txHash, character, from, amount]))[0].affectedRows == 1)
                        result = true;
                }
            }
            else {

                temporary = (await connectionGS.query(`SELECT item_id FROM reserved_item_ids LIMIT 1;`))[0];

                if (temporary.length == 0) {

                    this.emit("error", "No item_id was found in table reserved_item_ids");
                    this.emit("error", "-----------------------------------------------------------------------------------");
                    this.emit("error", "                            Manual rewarding is required");
                    this.emit("error", "-----------------------------------------------------------------------------------");
                    this.emit("error", "TxHash:    " + txHash);
                    this.emit("error", "Server id: " + id);
                    this.emit("error", "From:      " + from);
                    this.emit("error", "To:        " + character);
                    this.emit("error", "Amount:    " + amount);
                    this.emit("error", "-----------------------------------------------------------------------------------");
                }
                else {

                    const nextId = temporary[0].item_id;

                    if ((await connectionGS.query(`DELETE FROM reserved_item_ids WHERE item_id = '${nextId}' LIMIT 1;`))[0].affectedRows == 1) {

                        if ((await connectionGS.query(`INSERT INTO items (${lItemsCharacterId}, ${lItemsItemId}, ${lItemsItemTypeId}, ${lItemsItemAmount}, loc) VALUES (${charId}, ${nextId}, ${lRewardTypeId}, ?, 'INVENTORY');`, [amount]))[0].affectedRows == 1) {

                            if ((await connectionLS.query(`INSERT INTO fiskpay_deposits (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);`, [id, txHash, character, from, amount]))[0].affectedRows == 1) {

                                result = true;
                            }
                        }
                    }
                }
            }
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query(`COMMIT;`);
                await connectionGS.query(`COMMIT;`);
            }
            else {

                await connectionLS.query(`ROLLBACK;`);
                await connectionGS.query(`ROLLBACK;`);
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    CREATE_REFUND = async (address, amount, id, character, refund) => {//P

        const connectionLS = await this.#connections["ls"].getConnection();
        const connectionGS = await this.#connections[id].getConnection();
        const lAccountsAccountUsername = this.#serverData["ls"].tables.accounts.accountUsername;
        const lCharactersAccountUsername = this.#serverData[id].tables.characters.accountUsername;
        const lCharactersCharacterName = this.#serverData[id].tables.characters.characterName;
        const lCharactersCharacterId = this.#serverData[id].tables.characters.characterId
        const lItemsItemId = this.#serverData[id].tables.items.itemId;
        const lItemsCharacterId = this.#serverData[id].tables.items.characterId;
        const lItemsItemTypeId = this.#serverData[id].tables.items.itemTypeId;
        const lItemsItemAmount = this.#serverData[id].tables.items.itemAmount;
        const lRewardTypeId = this.#serverData[id].rewardId;

        let result = { "data": false };
        let temporary;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            temporary = (await connectionGS.query(`SELECT ${lCharactersCharacterId}, ${lCharactersAccountUsername}, online FROM characters WHERE ${lCharactersCharacterName} = ? LIMIT 1;`, [character]))[0];

            if (temporary.length != 1)
                result = { "fail": "Character " + character + " data not found" };
            else {

                const charId = temporary[0][lCharactersCharacterId];
                const charLogin = temporary[0][lCharactersAccountUsername];
                const charOnline = temporary[0].online;

                if (String(charOnline) == "1")
                    result = { "fail": "Character " + character + " is online" };
                else if ((await connectionLS.query(`SELECT server_id, character_id, amount, refund FROM fiskpay_temporary WHERE server_id = ? AND character_id = '${charId}' AND amount = ? AND refund = ?;`, [id, amount, refund]))[0].length != 0)
                    result = { "fail": "Trying to exploit? Help us grow, report your findings" };
                else {

                    temporary = (await connectionLS.query(`SELECT wallet_address FROM accounts WHERE ${lAccountsAccountUsername} = '${charLogin}' LIMIT 1;`))[0];

                    if (temporary.length != 1)
                        result = { "fail": "Character " + character + " login data not found" };
                    else {

                        const walletAddress = temporary[0].wallet_address;

                        if (walletAddress != address)
                            result = { "fail": "Wallet validation failed" };
                        else {

                            temporary = (await connectionGS.query(`SELECT SUM(${lItemsItemAmount}) AS balance FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND ${lItemsCharacterId} = '${charId}' AND loc = 'INVENTORY';`))[0][0];

                            const charBalance = Number((temporary.balance != null) ? (temporary.balance) : (0));

                            if (charBalance < amount)
                                result = { "fail": "Insufficient inventory balance" };
                            else if ((await connectionGS.query(`SELECT item_id FROM reserved_item_ids LIMIT 1;`))[0].length == 0)
                                result = { "fail": "Runned out of ids" };
                            else {

                                let remainAmount = amount;
                                let index = 0;

                                temporary = (await connectionGS.query(`SELECT ${lItemsItemAmount}, ${lItemsItemId} FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND ${lItemsCharacterId} = '${charId}' AND loc = 'INVENTORY';`))[0];

                                while (remainAmount > 0) {

                                    const rowItemAmount = temporary[index][lItemsItemAmount];
                                    const rowItemId = temporary[index][lItemsItemId];

                                    if (rowItemAmount > remainAmount && (await connectionGS.query(`UPDATE items SET ${lItemsItemAmount} = ${lItemsItemAmount} - '${remainAmount}' WHERE ${lItemsItemId} = '${rowItemId}' LIMIT 1;`))[0].changedRows == 1)
                                        remainAmount = 0;
                                    else if (rowItemAmount <= remainAmount && (await connectionGS.query(`DELETE FROM items WHERE ${lItemsItemId} = '${rowItemId}' LIMIT 1;`))[0].affectedRows == 1) {

                                        if ((await connectionGS.query(`INSERT INTO reserved_item_ids (item_id) VALUES (${rowItemId});`))[0].affectedRows != 1)
                                            break;

                                        if (rowItemAmount == remainAmount)
                                            remainAmount = 0;
                                        else
                                            remainAmount = remainAmount - rowItemAmount;
                                    }
                                    else
                                        break;

                                    index++;
                                }

                                if (remainAmount != 0)
                                    result = { "fail": "Token removal failed" };
                                else if ((await connectionLS.query(`INSERT INTO fiskpay_temporary (server_id, character_id, amount, refund) VALUES (?, ${charId}, ?, ?);`, [id, amount, refund]))[0].affectedRows == 1)
                                    result = { "data": true };
                            }
                        }
                    }
                }
            }
        }
        catch (error) {

            result = { "fail": "CREATE_REFUND SQL error" };
            this.emit("error", error);
        }
        finally {

            if (result.data === true) {

                await connectionLS.query(`COMMIT;`);
                await connectionGS.query(`COMMIT;`);
            }
            else {

                await connectionLS.query(`ROLLBACK;`);
                await connectionGS.query(`ROLLBACK;`);
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    LOG_WITHDRAWAL = async (txHash, to, amount, id, character, refund) => {//C

        const connectionLS = await this.#connections["ls"].getConnection();
        const connectionGS = await this.#connections[id].getConnection();
        const lCharactersCharacterName = this.#serverData[id].tables.characters.characterName;
        const lCharactersCharacterId = this.#serverData[id].tables.characters.characterId

        let result = false;
        let temporary;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            temporary = (await connectionGS.query(`SELECT ${lCharactersCharacterId} FROM characters WHERE ${lCharactersCharacterName} = ? LIMIT 1;`, [character]))[0][0];

            const charId = temporary[lCharactersCharacterId];

            if ((await connectionLS.query(`DELETE FROM fiskpay_temporary WHERE character_id = '${charId}' AND server_id = ? AND amount = ? AND refund = ? LIMIT 1;`, [id, amount, refund]))[0].affectedRows == 1)
                if ((await connectionLS.query(`INSERT INTO fiskpay_withdrawals (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);`, [id, txHash, character, to, amount]))[0].affectedRows == 1)
                    result = true;
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query(`COMMIT;`);
                await connectionGS.query(`COMMIT;`);
            }
            else {

                await connectionLS.query(`ROLLBACK;`);
                await connectionGS.query(`ROLLBACK;`);
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    REFUND_CHARACTERS = async (id) => {//C

        const connectionLS = await this.#connections["ls"].getConnection();
        const connectionGS = await this.#connections[id].getConnection();
        const lItemsItemId = this.#serverData[id].tables.items.itemId;
        const lItemsCharacterId = this.#serverData[id].tables.items.characterId;
        const lItemsItemTypeId = this.#serverData[id].tables.items.itemTypeId;
        const lItemsItemAmount = this.#serverData[id].tables.items.itemAmount;
        const lRewardTypeId = this.#serverData[id].rewardId;

        let result = false;
        let temporary;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            const listOfExpired = (await connectionLS.query(`SELECT character_id, amount, refund FROM fiskpay_temporary WHERE  refund < ${(Math.floor(Date.now() / 1000) + 30)} AND server_id = ?`, [id]))[0];

            let processed = 0;

            for (const row of listOfExpired) {

                const charId = row.character_id;
                const amount = row.amount;
                const refund = row.refund;

                temporary = (await connectionGS.query(`SELECT ${lItemsItemId} FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND loc = 'INVENTORY' AND ${lItemsCharacterId} = '${charId}' LIMIT 1;`))[0];

                if (temporary.length == 1) {

                    const itemId = temporary[0][lItemsItemId];

                    if ((await connectionGS.query(`UPDATE items SET ${lItemsItemAmount} = ${lItemsItemAmount} + '${amount}' WHERE ${lItemsItemId} = '${itemId}' LIMIT 1;`))[0].changedRows == 1)
                        if ((await connectionLS.query(`DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = '${charId}' AND amount = '${amount}' AND refund = '${refund}' LIMIT 1;`, [id]))[0].affectedRows == 1)
                            processed++;
                }
                else {

                    temporary = (await connectionGS.query(`SELECT item_id FROM reserved_item_ids LIMIT 1;`))[0];

                    if (temporary.length == 1) {

                        const nextId = temporary[0].item_id;

                        if ((await connectionGS.query(`DELETE FROM reserved_item_ids WHERE item_id = '${nextId}' LIMIT 1;`))[0].affectedRows == 1) {

                            if ((await connectionGS.query(`INSERT INTO items (${lItemsCharacterId}, ${lItemsItemId}, ${lItemsItemTypeId}, ${lItemsItemAmount}, loc) VALUES (${charId}, ${nextId}, ${lRewardTypeId}, ${amount}, 'INVENTORY');`))[0].affectedRows == 1) {

                                if ((await connectionLS.query(`DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = '${charId}' AND amount = '${amount}' AND refund = '${refund}' LIMIT 1;`, [id]))[0].affectedRows == 1) {

                                    processed++;
                                }
                            }
                        }
                    }
                }
            }

            result = (processed == listOfExpired.length);
        }
        catch (error) {

            result = false;
            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query(`COMMIT;`);
                await connectionGS.query(`COMMIT;`);
            }
            else {

                await connectionLS.query(`ROLLBACK;`);
                await connectionGS.query(`ROLLBACK;`);
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }
}

module.exports = Connector;