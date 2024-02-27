const mysql = require("mysql2/promise");
const EventEmitter = require("node:events");
const crypto = require("node:crypto");

let encAlgo;
let algo = [];

algo[0] = (pass) => {

    return crypto.createHash("sha1").update(pass).digest('base64');
}

algo[1] = (pass) => {

    return crypto.createHash("md5").update(pass).digest('base64');
}

algo[2] = (pass) => {

    return crypto.createHash("sha256").update(pass).digest('base64');
}

algo[3] = (pass) => {

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
}

algo[4] = (pass) => {

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
    #connections = class { this = []; }
    #serverData = {}

    constructor(config, remoteIPAddress) {

        super();

        this.#config = config;
        this.#remoteIPAddress = remoteIPAddress;
    }

    #initializeIdData = (id, groups) => {

        let startNextId = (((738197503 - Number(groups.max0)) > 50000) ? (Number(groups.max0) + 1) : (268435456 + 1000000));
        let startNowGroup = "group0";
        let minValue = Number(groups.sum0);

        if (Number(groups.sum1) < minValue) {

            startNextId = (((1207959551 - Number(groups.max1)) > 50000) ? (Number(groups.max1) + 1) : (738197504 + 1000000));
            startNowGroup = "group1";

            minValue = Number(groups.sum1);
        }

        if (Number(groups.sum2) < minValue) {

            startNextId = (((1677721599 - Number(groups.max2)) > 50000) ? (Number(groups.max2) + 1) : (1207959552 + 1000000));
            startNowGroup = "group2";

            minValue = Number(groups.sum2);
        }

        if (Number(groups.sum3) < minValue) {

            startNextId = (((2147483647 - Number(groups.max3)) > 50000) ? (Number(groups.max3) + 1) : (1677721600 + 1000000));
            startNowGroup = "group3";
        }

        this.#serverData[id].reward = { "typeId": this.#config[id].rewardTypeId, "nextId": startNextId, "nowGroup": startNowGroup, "group0": Number(groups.sum0), "group1": Number(groups.sum1), "group2": Number(groups.sum2), "group3": Number(groups.sum3) };

        return true;
    }

    #updateIdData = (id, groups) => {

        if (this.#serverData[id].reward.nowGroup == "group0" && (Number(groups.sum0) > this.#serverData[id].reward.group0 || Number(groups.sum3) > this.#serverData[id].reward.group3)) {

            this.#serverData[id].reward.nextId = (((1677721599 - Number(groups.max2)) > 50000) ? (Number(groups.max2) + 1) : (1207959552 + 1000000));
            this.#serverData[id].reward.nowGroup = "group2";
        }
        else if (this.#serverData[id].reward.nowGroup == "group1" && (Number(groups.sum1) > this.#serverData[id].reward.group1 || Number(groups.sum0) > this.#serverData[id].reward.group0)) {

            this.#serverData[id].reward.nextId = (((2147483647 - Number(groups.max3)) > 50000) ? (Number(groups.max3) + 1) : (1677721600 + 1000000));
            this.#serverData[id].reward.nowGroup = "group3";
        }
        else if (this.#serverData[id].reward.nowGroup == "group2" && (Number(groups.sum2) > this.#serverData[id].reward.group2 || Number(groups.sum1) > this.#serverData[id].reward.group1)) {

            this.#serverData[id].reward.nextId = (((738197503 - Number(groups.max0)) > 50000) ? (Number(groups.max0) + 1) : (268435456 + 1000000));
            this.#serverData[id].reward.nowGroup = "group0";
        }
        else if (this.#serverData[id].reward.nowGroup == "group3" && (Number(groups.sum3) > this.#serverData[id].reward.group3 || Number(groups.sum2) > this.#serverData[id].reward.group2)) {

            this.#serverData[id].reward.nextId = (((1207959551 - Number(groups.max1)) > 50000) ? (Number(groups.max1) + 1) : (738197504 + 1000000));
            this.#serverData[id].reward.nowGroup = "group1";
        }

        return true;
    }

    #increaseIdCountBy = (id, amount) => {


        this.#serverData[id].reward.group0 += ((this.#serverData[id].reward.nowGroup == "group0") ? (amount) : (0));
        this.#serverData[id].reward.group1 += ((this.#serverData[id].reward.nowGroup == "group1") ? (amount) : (0));
        this.#serverData[id].reward.group2 += ((this.#serverData[id].reward.nowGroup == "group2") ? (amount) : (0));
        this.#serverData[id].reward.group3 += ((this.#serverData[id].reward.nowGroup == "group3") ? (amount) : (0));

        return true;
    }

    #decreaseIdCountBy = (id, amount) => {

        this.#serverData[id].reward.group0 -= ((this.#serverData[id].reward.nowGroup == "group0") ? (amount) : (0));
        this.#serverData[id].reward.group1 -= ((this.#serverData[id].reward.nowGroup == "group1") ? (amount) : (0));
        this.#serverData[id].reward.group2 -= ((this.#serverData[id].reward.nowGroup == "group2") ? (amount) : (0));
        this.#serverData[id].reward.group3 -= ((this.#serverData[id].reward.nowGroup == "group3") ? (amount) : (0));

        return true;
    }

    #getNextId = (id) => {

        this.#serverData[id].reward.nextId = ((this.#serverData[id].reward.nextId < 2147483647) ? (this.#serverData[id].reward.nextId + 1) : (268435456));

        return (this.#serverData[id].reward.nextId);
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
                    "connectionLimit": ((id == "ls") ? (12 + 1) : (3 + 1)),
                    "maxIdle": ((id == "ls") ? (4) : (1)),
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

                this.#serverData[id] = { "interval": undefined, "tables": undefined, "reward": undefined }
                this.#serverData[id].interval = setInterval(() => { connection.query(`SELECT 1;`); }, 45000);

                this.emit("updateServer", id, true);
            }
            catch (e) {

                this.emit("updateServer", id, false);
            }
            finally {

                resolve(true)
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

                    //await connection.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) NOT NULL DEFAULT 'not linked';`);
                    //await connection.query(`ALTER TABLE gameservers ADD COLUMN IF NOT EXISTS balance INT(10) UNSIGNED NOT NULL DEFAULT '0';`);
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
                const itemsOnGroundTable = (await connection.query(`SHOW COLUMNS FROM items_on_ground;`))[0];
                const clanDataTable = (await connection.query(`SHOW COLUMNS FROM clan_data;`))[0];
                const weddingTable = (await connection.query(`SHOW COLUMNS FROM mods_wedding;`))[0];

                const gsConfig = this.#config[id].dbTableColumns;

                charactersTable.forEach((column) => {

                    if (column.Field == gsConfig.characters.accountUsername || column.Field == gsConfig.characters.characterId || column.Field == gsConfig.characters.characterName)
                        checks++;
                });

                itemsTable.forEach((column) => {

                    if (column.Field == gsConfig.items.characterId || column.Field == gsConfig.items.itemId || column.Field == gsConfig.items.itemTypeId || column.Field == gsConfig.items.itemAmount)
                        checks++
                });

                itemsOnGroundTable.forEach((column) => {

                    if (column.Field == gsConfig.items_on_ground.itemId)
                        checks++
                });

                clanDataTable.forEach((column) => {

                    if (column.Field == gsConfig.clan_data.clanId)
                        checks++
                });

                weddingTable.forEach((column) => {

                    if (column.Field == gsConfig.mods_wedding.weddingId)
                        checks++
                });

                if (checks == 10) {

                    const groups = (await connection.query(`
                    SELECT
                        MAX(groups.group0) AS max0,
                        SUM(IF (groups.group0 IS NOT NULL, 1, 0)) AS sum0,
                        MAX(groups.group1) AS max1,
                        SUM(IF (groups.group1 IS NOT NULL, 1, 0)) AS sum1,
                        MAX(groups.group2) AS max2,
                        SUM(IF (groups.group2 IS NOT NULL, 1, 0)) AS sum2,
                        MAX(groups.group3) AS max3,
                        SUM(IF (groups.group3 IS NOT NULL, 1, 0)) AS sum3
                    FROM (
                        SELECT
                            (SELECT ids.id WHERE ids.id BETWEEN 268435456 AND 738197503) AS group0,
                            (SELECT ids.id WHERE ids.id BETWEEN 738197504 AND 1207959551) AS group1,
                            (SELECT ids.id WHERE ids.id BETWEEN 1207959552 AND 1677721599) AS group2,
                            (SELECT ids.id WHERE ids.id BETWEEN 1677721600 AND 2147483647) AS group3
                        FROM (
                            SELECT ${gsConfig.characters.characterId} AS id FROM characters
                            UNION
                            SELECT ${gsConfig.items.itemId} AS id FROM items
                            UNION
                            SELECT ${gsConfig.items_on_ground.itemId} AS id FROM items_on_ground
                            UNION
                            SELECT ${gsConfig.clan_data.clanId} AS id FROM clan_data
                            UNION
                            SELECT ${gsConfig.mods_wedding.weddingId} AS id FROM mods_wedding
                            ORDER BY id
                        ) AS ids
                    ) AS groups
                    `))[0][0];

                    this.#initializeIdData(id, groups);
                    this.#serverData[id].tables = gsConfig;

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

        let result;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT ${lGameserversGameserverId} FROM gameservers;`))[0];
            result = temporary.map(key => key[lGameserversGameserverId])
        }
        catch (error) {

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

                if (walletAddress != "not linked")
                    result = { "fail": "Account " + username + " already linked to an Ethereum address" };
                else if (!validatePassword(password, targetPassword))
                    result = { "fail": "Username - password mismatch" };
                else
                    result = { "data": ((await connection.query(`UPDATE accounts SET wallet_address = ? WHERE ${lCharactersAccountUsername} = ? AND wallet_address = 'not linked' AND ${lAccountsAccountPassword} = '${targetPassword}';`, [ethAddress, username]))[0].changedRows == 1) };
            }
            else if (temporary.length == 0)
                result = { "fail": "Account " + username + " does not exist" };
            else
                result = { "fail": "Multiple instances of account " + username };
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

                if (walletAddress != ethAddress)
                    result = { "fail": "Account " + username + " not linked to your Ethereum address" };
                else if (!validatePassword(password, targetPassword))
                    result = { "fail": "Username - password mismatch" };
                else
                    result = { "data": ((await connection.query(`UPDATE accounts SET wallet_address = 'not linked' WHERE ${lCharactersAccountUsername} = ? AND wallet_address = ? AND ${lAccountsAccountPassword} = '${targetPassword}';`, [username, ethAddress]))[0].changedRows == 1) };
            }
            else if (temporary.length == 0)
                result = { "fail": "Account " + username + " does not exist" };
            else
                result = { "fail": "Multiple instances of account " + username };
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
        const lRewardTypeId = this.#serverData[id].reward.typeId;

        let result;
        let temporary;

        try {

            temporary = (await connection.query(`SELECT SUM(i.${lItemsItemAmount}) AS balance FROM items AS i, characters AS c WHERE c.${lCharactersCharacterId} = i.${lItemsCharacterId} AND c.${lCharactersCharacterName} = ? AND i.${lItemsItemTypeId} = '${lRewardTypeId}' AND i.loc = 'inventory';`, [charname]))[0][0];
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
        const lRewardTypeId = this.#serverData[id].reward.typeId;

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

            result = { "fail": "CHECK_IF_CHARACTER_ONLINE SQL error" };
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
        const lRewardTypeId = this.#serverData[id].reward.typeId;

        let result = false;
        let temporary;

        let addedIds = 0;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            const groups = (await connectionGS.query(`
            SELECT
                MAX(groups.group0) AS max0,
                SUM(IF (groups.group0 IS NOT NULL, 1, 0)) AS sum0,
                MAX(groups.group1) AS max1,
                SUM(IF (groups.group1 IS NOT NULL, 1, 0)) AS sum1,
                MAX(groups.group2) AS max2,
                SUM(IF (groups.group2 IS NOT NULL, 1, 0)) AS sum2,
                MAX(groups.group3) AS max3,
                SUM(IF (groups.group3 IS NOT NULL, 1, 0)) AS sum3
            FROM (
                SELECT
                    (SELECT ids.id WHERE ids.id BETWEEN 268435456 AND 738197503) AS group0,
                    (SELECT ids.id WHERE ids.id BETWEEN 738197504 AND 1207959551) AS group1,
                    (SELECT ids.id WHERE ids.id BETWEEN 1207959552 AND 1677721599) AS group2,
                    (SELECT ids.id WHERE ids.id BETWEEN 1677721600 AND 2147483647) AS group3
                FROM (
                    SELECT ${this.#serverData[id].tables.characters.characterId} AS id FROM characters
                    UNION
                    SELECT ${this.#serverData[id].tables.items.itemId} AS id FROM items
                    UNION
                    SELECT ${this.#serverData[id].tables.items_on_ground.itemId} AS id FROM items_on_ground
                    UNION
                    SELECT ${this.#serverData[id].tables.clan_data.clanId} AS id FROM clan_data
                    UNION
                    SELECT ${this.#serverData[id].tables.mods_wedding.weddingId} AS id FROM mods_wedding
                    ORDER BY id
                ) AS ids
            ) AS groups
            `))[0][0];

            this.#updateIdData(id, groups);

            temporary = (await connectionGS.query(`SELECT ${lCharactersCharacterId} FROM characters WHERE ${lCharactersCharacterName} = ? LIMIT 1;`, [character]))[0][0];

            const charId = temporary[lCharactersCharacterId];

            temporary = (await connectionGS.query(`SELECT ${lItemsItemId} FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND loc = 'inventory' AND ${lItemsCharacterId} = '${charId}' LIMIT 1;`))[0];

            if (temporary.length == 1) {

                const itemId = temporary[0][lItemsItemId];

                if ((await connectionGS.query(`UPDATE items SET ${lItemsItemAmount} = ${lItemsItemAmount} + ? WHERE ${lItemsItemId} = '${itemId}' LIMIT 1;`, [amount]))[0].changedRows == 1) {

                    if ((await connectionLS.query(`INSERT INTO fiskpay_deposits (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);`, [id, txHash, character, from, amount]))[0].affectedRows == 1)
                        result = true;
                }

            }
            else {

                let nextId = this.#getNextId(id);

                while ((await connectionGS.query(`SELECT COUNT(${lItemsItemId}) AS instances FROM items WHERE ${lItemsItemId} = '${nextId}';`))[0][0].instances > 0)
                    nextId = this.#getNextId(id);

                if ((await connectionGS.query(`INSERT INTO items (${lItemsCharacterId}, ${lItemsItemId}, ${lItemsItemTypeId}, ${lItemsItemAmount}, loc) VALUES (${charId}, ${nextId}, ${lRewardTypeId}, ?, 'inventory');`, [amount]))[0].affectedRows == 1) {

                    if ((await connectionLS.query(`INSERT INTO fiskpay_deposits (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);`, [id, txHash, character, from, amount]))[0].affectedRows == 1) {

                        addedIds++;
                        result = true;
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

                this.#increaseIdCountBy(id, addedIds);

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
        const lRewardTypeId = this.#serverData[id].reward.typeId;

        let result = { "data": false };
        let temporary;

        let removedIds = 0;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            const groups = (await connectionGS.query(`
            SELECT
                MAX(groups.group0) AS max0,
                SUM(IF (groups.group0 IS NOT NULL, 1, 0)) AS sum0,
                MAX(groups.group1) AS max1,
                SUM(IF (groups.group1 IS NOT NULL, 1, 0)) AS sum1,
                MAX(groups.group2) AS max2,
                SUM(IF (groups.group2 IS NOT NULL, 1, 0)) AS sum2,
                MAX(groups.group3) AS max3,
                SUM(IF (groups.group3 IS NOT NULL, 1, 0)) AS sum3
            FROM (
                SELECT
                    (SELECT ids.id WHERE ids.id BETWEEN 268435456 AND 738197503) AS group0,
                    (SELECT ids.id WHERE ids.id BETWEEN 738197504 AND 1207959551) AS group1,
                    (SELECT ids.id WHERE ids.id BETWEEN 1207959552 AND 1677721599) AS group2,
                    (SELECT ids.id WHERE ids.id BETWEEN 1677721600 AND 2147483647) AS group3
                FROM (
                    SELECT ${this.#serverData[id].tables.characters.characterId} AS id FROM characters
                    UNION
                    SELECT ${this.#serverData[id].tables.items.itemId} AS id FROM items
                    UNION
                    SELECT ${this.#serverData[id].tables.items_on_ground.itemId} AS id FROM items_on_ground
                    UNION
                    SELECT ${this.#serverData[id].tables.clan_data.clanId} AS id FROM clan_data
                    UNION
                    SELECT ${this.#serverData[id].tables.mods_wedding.weddingId} AS id FROM mods_wedding
                    ORDER BY id
                ) AS ids
            ) AS groups
            `))[0][0];

            this.#updateIdData(id, groups);

            temporary = (await connectionGS.query(`SELECT ${lCharactersCharacterId}, ${lCharactersAccountUsername} FROM characters WHERE ${lCharactersCharacterName} = ? LIMIT 1;`, [character]))[0];

            if (temporary.length != 1)
                result = { "fail": "Character " + character + " data not found" };
            else {

                const charId = temporary[0][lCharactersCharacterId];
                const charLogin = temporary[0][lCharactersAccountUsername];

                if ((await connectionLS.query(`SELECT server_id, character_id, amount, refund FROM fiskpay_temporary WHERE server_id = ? AND character_id = '${charId}' AND amount = ? AND refund = ?;`, [id, amount, refund]))[0].length != 0)
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

                            temporary = (await connectionGS.query(`SELECT SUM(${lItemsItemAmount}) AS balance FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND ${lItemsCharacterId} = '${charId}' AND loc = 'inventory';`))[0][0];

                            const charBalance = Number((temporary.balance != null) ? (temporary.balance) : (0));

                            if (charBalance < amount)
                                result = { "fail": "Insufficient inventory balance" };
                            else {

                                let remainAmount = amount;
                                let index = 0;

                                temporary = (await connectionGS.query(`SELECT ${lItemsItemAmount}, ${lItemsItemId} FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND ${lItemsCharacterId} = '${charId}' AND loc = 'inventory';`))[0];

                                while (remainAmount > 0) {

                                    const rowItemAmount = temporary[index][lItemsItemAmount];
                                    const rowItemId = temporary[index][lItemsItemId];

                                    if (rowItemAmount > remainAmount && (await connectionGS.query(`UPDATE items SET ${lItemsItemAmount} = ${lItemsItemAmount} - '${remainAmount}' WHERE ${lItemsItemId} = '${rowItemId}' LIMIT 1;`))[0].changedRows == 1)
                                        remainAmount = 0;
                                    else if (rowItemAmount <= remainAmount && (await connectionGS.query(`DELETE FROM items WHERE ${lItemsItemId} = '${rowItemId}' LIMIT 1;`))[0].affectedRows == 1) {

                                        if (rowItemAmount == remainAmount)
                                            remainAmount = 0;
                                        else
                                            remainAmount = remainAmount - rowItemAmount;

                                        removedIds++;
                                    }
                                    else
                                        break;

                                    index++;
                                }

                                if (remainAmount != 0)
                                    result = { "fail": "Token removal failed" };
                                else if ((await connectionLS.query(`INSERT INTO fiskpay_temporary (server_id, character_id, amount, refund) VALUES (?, ${charId}, ?, ?);`, [id, amount, refund]))[0].affectedRows != 1)
                                    result = { "data": false };
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

                this.#decreaseIdCountBy(id, removedIds);

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
        const lRewardTypeId = this.#serverData[id].reward.typeId;

        let result = false;
        let temporary;

        let addedIds = 0;

        try {

            await connectionLS.query(`SET autocommit = 0;`);
            await connectionGS.query(`SET autocommit = 0;`);
            await connectionLS.query(`START TRANSACTION;`);
            await connectionGS.query(`START TRANSACTION;`);

            const groups = (await connectionGS.query(`
            SELECT
                MAX(groups.group0) AS max0,
                SUM(IF (groups.group0 IS NOT NULL, 1, 0)) AS sum0,
                MAX(groups.group1) AS max1,
                SUM(IF (groups.group1 IS NOT NULL, 1, 0)) AS sum1,
                MAX(groups.group2) AS max2,
                SUM(IF (groups.group2 IS NOT NULL, 1, 0)) AS sum2,
                MAX(groups.group3) AS max3,
                SUM(IF (groups.group3 IS NOT NULL, 1, 0)) AS sum3
            FROM (
                SELECT
                    (SELECT ids.id WHERE ids.id BETWEEN 268435456 AND 738197503) AS group0,
                    (SELECT ids.id WHERE ids.id BETWEEN 738197504 AND 1207959551) AS group1,
                    (SELECT ids.id WHERE ids.id BETWEEN 1207959552 AND 1677721599) AS group2,
                    (SELECT ids.id WHERE ids.id BETWEEN 1677721600 AND 2147483647) AS group3
                FROM (
                    SELECT ${this.#serverData[id].tables.characters.characterId} AS id FROM characters
                    UNION
                    SELECT ${this.#serverData[id].tables.items.itemId} AS id FROM items
                    UNION
                    SELECT ${this.#serverData[id].tables.items_on_ground.itemId} AS id FROM items_on_ground
                    UNION
                    SELECT ${this.#serverData[id].tables.clan_data.clanId} AS id FROM clan_data
                    UNION
                    SELECT ${this.#serverData[id].tables.mods_wedding.weddingId} AS id FROM mods_wedding
                    ORDER BY id
                ) AS ids
            ) AS groups
            `))[0][0];

            this.#updateIdData(id, groups);

            const listOfExpired = (await connectionLS.query(`SELECT character_id, amount, refund FROM fiskpay_temporary WHERE  refund < ${(Math.floor(Date.now() / 1000) + 30)} AND server_id = ?`, [id]))[0];

            let processed = 0;

            for (const row of listOfExpired) {

                const charId = row.character_id;
                const amount = row.amount;
                const refund = row.refund;

                temporary = (await connectionGS.query(`SELECT ${lItemsItemId} FROM items WHERE ${lItemsItemTypeId} = '${lRewardTypeId}' AND loc = 'inventory' AND ${lItemsCharacterId} = '${charId}' LIMIT 1;`))[0];

                if (temporary.length == 1) {

                    const itemId = temporary[0][lItemsItemId];

                    if ((await connectionGS.query(`UPDATE items SET ${lItemsItemAmount} = ${lItemsItemAmount} + '${amount}' WHERE ${lItemsItemId} = '${itemId}' LIMIT 1;`))[0].changedRows == 1)
                        if ((await connectionLS.query(`DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = '${charId}' AND amount = '${amount}' AND refund = '${refund}' LIMIT 1;`, [id]))[0].affectedRows == 1)
                            processed++;
                }
                else {

                    let nextId = this.#getNextId(id);

                    while ((await connectionGS.query(`SELECT COUNT(${lItemsItemId}) AS instances FROM items WHERE ${lItemsItemId} = '${nextId}';`))[0][0].instances > 0)
                        nextId = this.#getNextId(id);

                    if ((await connectionGS.query(`INSERT INTO items (${lItemsCharacterId}, ${lItemsItemId}, ${lItemsItemTypeId}, ${lItemsItemAmount}, loc) VALUES (${charId}, ${nextId}, ${lRewardTypeId}, ${amount}, 'inventory');`))[0].affectedRows == 1) {

                        if ((await connectionLS.query(`DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = '${charId}' AND amount = '${amount}' AND refund = '${refund}' LIMIT 1;`, [id]))[0].affectedRows == 1) {

                            processed++;
                            addedIds++;
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

                this.#increaseIdCountBy(id, addedIds);

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