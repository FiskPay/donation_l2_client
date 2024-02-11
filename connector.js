const mysql = require("mysql2");
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
    #serverConnections = class { this = []; }
    #serverTables = {}
    #serverReward = {}
    #serverInterval = {}

    constructor(config, remoteIPAddress) {

        super();

        this.#config = config;
        this.#remoteIPAddress = remoteIPAddress;
    }

    GET_HASH = () => {

        return crypto.createHash("sha256").update(this.#config["client"].password + this.#remoteIPAddress + this.#config["ls"].dbPort).digest("hex");
    }

    GET_ADDRESS = () => {

        return this.#config["client"].walletAddress;
    }

    CONNECT_SERVER = async (id) => {

        const config = {

            "database": this.#config[id].dbName,
            "host": ((id == "ls" || this.#config[id].dbIPAddress == this.#remoteIPAddress) ? ("127.0.0.1") : (this.#config[id].dbIPAddress)),
            "port": this.#config[id].dbPort,
            "user": this.#config[id].dbUsername,
            "password": this.#config[id].dbPassword,
            "waitForConnections": true,
            "connectionLimit": 25,
            "maxIdle": 6,
            "idleTimeout": 60000,
            "queueLimit": 0
        }

        try {

            let connection;

            this.#serverConnections[id] = mysql.createPool(config).promise();

            connection = await this.#serverConnections[id].getConnection();
            connection.on("error", () => {

                clearInterval(this.#serverInterval[id]);
                this.emit("updateServer", id, false);
            });

            this.#serverInterval[id] = setInterval(() => { connection.query("SELECT 1;"); }, 45000);
            this.emit("updateServer", id, true);
        }
        catch {

            this.emit("updateServer", id, false);
        }

        return await new Promise((resolve) => setTimeout(() => { resolve(true); }, 500));
    }

    DISCONNECT_SERVER = async (id) => {

        clearInterval(this.#serverInterval[id]);
        await this.#serverConnections[id].end();

        return true;
    }

    VALIDATE_SERVER = async (id) => {

        const connection = await this.#serverConnections[id].getConnection();

        let checks = 0;
        let result = false;

        try {

            if (id == "ls") {

                const accountsTable = (await connection.query("SHOW COLUMNS FROM accounts;"))[0];
                const gameserversTable = (await connection.query("SHOW COLUMNS FROM gameservers;"))[0];

                const lsConfig = this.#config["ls"].dbTableColumns;

                accountsTable.forEach((column) => {

                    if (column.Field == lsConfig.accounts.accountUsername || column.Field == lsConfig.accounts.accountPassword)
                        checks++;
                });

                gameserversTable.forEach((column) => {

                    if (column.Field == lsConfig.gameservers.gameserverId)
                        checks++
                });

                if (checks == 3) {

                    //await connection.query("SET autocommit = OFF;");
                    //await connection.query("START TRANSACTION;");
                    await connection.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) NOT NULL DEFAULT 'not linked';");
                    await connection.query("ALTER TABLE gameservers ADD COLUMN IF NOT EXISTS balance INT(10) UNSIGNED NOT NULL DEFAULT '0';");
                    await connection.query("CREATE TABLE IF NOT EXISTS fiskpay_deposits (server_id INT(11) NOT NULL, transaction_hash VARCHAR(66) NOT NULL, character_name VARCHAR(35) NOT NULL, wallet_address VARCHAR(42) NOT NULL, amount INT(10) UNSIGNED NOT NULL, PRIMARY KEY(transaction_hash)) ENGINE = InnoDB DEFAULT CHARSET = utf8;");
                    await connection.query("CREATE TABLE IF NOT EXISTS fiskpay_withdrawals (server_id INT(11) NOT NULL, transaction_hash VARCHAR(66) NOT NULL, character_name VARCHAR(35) NOT NULL, wallet_address VARCHAR(42) NOT NULL, amount INT(10) UNSIGNED NOT NULL, PRIMARY KEY(transaction_hash)) ENGINE = InnoDB DEFAULT CHARSET = utf8;");
                    await connection.query("CREATE TABLE IF NOT EXISTS fiskpay_temporary (server_id INT(11) NOT NULL, character_id INT(10) NOT NULL, amount INT(10) UNSIGNED NOT NULL, refund INT(10) UNSIGNED NOT NULL, PRIMARY KEY(server_id, character_id, refund)) ENGINE = InnoDB DEFAULT CHARSET = utf8;");
                    //await connection.query("COMMIT;");

                    this.#serverTables["ls"] = lsConfig;

                    result = true;
                }
            }
            else {

                const charactersTable = (await connection.query("SHOW COLUMNS FROM characters;"))[0];
                const itemsTable = (await connection.query("SHOW COLUMNS FROM items;"))[0];

                const gsConfig = this.#config[id].dbTableColumns;

                charactersTable.forEach((column) => {

                    if (column.Field == gsConfig.characters.accountUsername || column.Field == gsConfig.characters.characterId || column.Field == gsConfig.characters.characterName)
                        checks++;
                });

                itemsTable.forEach((column) => {

                    if (column.Field == gsConfig.items.characterId || column.Field == gsConfig.items.itemId || column.Field == gsConfig.items.itemTypeId || column.Field == gsConfig.items.itemAmount)
                        checks++
                });

                if (checks == 7) {

                    this.#serverTables[id] = gsConfig;
                    this.#serverReward[id] = this.#config[id].rewardId;

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

    GET_IDS = async () => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const id = this.#serverTables["ls"].gameservers.gameserverId;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + id + " FROM gameservers;"))[0];
            result = temporary.map(key => key[id])
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

    GET_TOTAL_CLIENT_BALANCE = async () => {

        const connection = await this.#serverConnections["ls"].getConnection();

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT SUM(balance) AS balance FROM gameservers;"))[0][0];
            result = (temporary.balance != null) ? (temporary.balance) : ("0");
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

    GET_ACCOUNTS = async (ethAddress) => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const accnm = this.#serverTables["ls"].accounts.accountUsername;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + accnm + " FROM accounts WHERE wallet_address = ?;", [ethAddress]))[0];
            result = temporary.map(key => key[accnm]);
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

    ADD_ACCOUNT = async (username, password, ethAddress) => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const accnm = this.#serverTables["ls"].accounts.accountUsername;
        const psw = this.#serverTables["ls"].accounts.accountPassword;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + psw + " FROM accounts WHERE " + accnm + " = ?", [username]))[0][0];

            if (validatePassword(password, temporary[psw])) {

                await connection.query("SET autocommit = 0;");
                await connection.query("START TRANSACTION;");

                temporary = (await connection.query("UPDATE accounts SET wallet_address = ? WHERE " + accnm + " = ? AND wallet_address = 'not linked' AND " + psw + " = ?;", [ethAddress, username, temporary[psw]]))[0];
                result = (temporary.changedRows == 1)
            }
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true)
                await connection.query("COMMIT;");
            else
                await connection.query("ROLLBACK;");

            connection.release();

            return result;
        }
    }

    REMOVE_ACCOUNT = async (username, password, ethAddress) => {

        const connection = await this.#serverConnections["ls"].getConnection();
        const accnm = this.#serverTables["ls"].accounts.accountUsername;
        const psw = this.#serverTables["ls"].accounts.accountPassword;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + psw + " FROM accounts WHERE " + accnm + " = ?", [username]))[0][0];

            if (validatePassword(password, temporary[psw])) {

                await connection.query("SET autocommit = 0;");
                await connection.query("START TRANSACTION;");

                temporary = (await connection.query("UPDATE accounts SET wallet_address = 'not linked' WHERE " + accnm + " = ? AND wallet_address = ? AND " + psw + " = ?;", [username, ethAddress, temporary[psw]]))[0];
                result = (temporary.changedRows == 1)
            }
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true)
                await connection.query("COMMIT;");
            else
                await connection.query("ROLLBACK;");

            connection.release();

            return result;
        }
    }

    GET_CHARACTERS = async (id, username) => {

        const connection = await this.#serverConnections[id].getConnection();
        const accnm = this.#serverTables[id].characters.accountUsername;
        const chnm = this.#serverTables[id].characters.characterName;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT " + chnm + " FROM characters WHERE " + accnm + " = ?;", [username]))[0];
            result = temporary.map(key => key[chnm]);
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

    GET_CHARACTER_BALANCE = async (id, charname) => {

        const connection = await this.#serverConnections[id].getConnection();
        const cchnm = this.#serverTables[id].characters.characterName;
        const cchid = this.#serverTables[id].characters.characterId;
        const ichid = this.#serverTables[id].items.characterId;
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;

        let result = false;
        let temporary;

        try {

            temporary = (await connection.query("SELECT SUM(i." + iitam + ") AS balance FROM items AS i, characters AS c WHERE c." + cchid + " = i." + ichid + " AND c." + cchnm + " = ? AND i." + iitmtyid + " = ? AND i.loc = 'inventory';", [charname, this.#serverReward[id]]))[0][0];
            result = (temporary.balance != null) ? (temporary.balance) : ("0");
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

    UPDATE_GAMESERVER_BALANCE = async (id) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;
        const srvid = this.#serverTables["ls"].gameservers.gameserverId;

        let result = false;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            temporary = (await connectionGS.query("SELECT SUM(" + iitam + ") AS balance FROM items WHERE  " + iitmtyid + " = ?;", [this.#serverReward[id]]))[0][0];
            temporary = (temporary.balance != null) ? (temporary.balance) : (0);

            temporary = (await connectionLS.query("UPDATE gameservers SET balance = ? WHERE " + srvid + " = ?;", [temporary, id]))[0];
            result = (temporary.changedRows == 1)
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }
            else {

                await connectionLS.query("ROLLBACK;");
                await connectionGS.query("ROLLBACK;");
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    LOG_DEPOSIT = async (txHash, from, amount, id, character) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const cchnm = this.#serverTables[id].characters.characterName;
        const cchid = this.#serverTables[id].characters.characterId
        const iid = this.#serverTables[id].items.itemId;;
        const ichid = this.#serverTables[id].items.characterId;
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;

        let result = false;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            temporary = (await connectionGS.query("SELECT " + cchid + " FROM characters WHERE  " + cchnm + " = ? LIMIT 1;", [character]))[0][0];

            const charID = temporary[cchid];

            temporary = (await connectionGS.query("SELECT " + iid + " FROM items WHERE  " + iitmtyid + " = ? AND loc = 'inventory' AND " + ichid + " = ? LIMIT 1;", [this.#serverReward[id], charID]))[0];

            if (temporary.length == 1) {

                temporary = (await connectionGS.query("UPDATE items SET " + iitam + " = " + iitam + " + ? WHERE " + iid + " = ? LIMIT 1;", [amount, temporary[0][iid]]))[0];
                result = (temporary.changedRows == 1);
            }
            else {

                let testID = 2100000000 + Math.floor(Math.random() * 9999900);

                do {

                    testID++;
                    temporary = (await connectionGS.query("SELECT COUNT(" + iid + ") AS instances FROM items WHERE " + iid + " = ?;", [testID]))[0][0];
                    temporary = (temporary.instances != null) ? (temporary.instances) : (0);

                } while (temporary > 0)

                temporary = (await connectionGS.query("INSERT INTO items (" + ichid + ", " + iid + ", " + iitmtyid + ", " + iitam + ", loc) VALUES (?, ?, ?, ?, 'inventory');", [charID, testID, this.#serverReward[id], amount]))[0];
                result = (temporary.affectedRows == 1);
            }

            if (result == true && (await connectionLS.query("INSERT INTO fiskpay_deposits (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);", [id, txHash, character, from, amount]))[0].affectedRows != 1)
                result = false;
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }
            else {

                await connectionLS.query("ROLLBACK;");
                await connectionGS.query("ROLLBACK;");
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    CREATE_REFUND = async (address, amount, id, character, refund) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const ausrnm = this.#serverTables["ls"].accounts.accountUsername;
        const cusrnm = this.#serverTables[id].characters.accountUsername;
        const cchnm = this.#serverTables[id].characters.characterName;
        const cchid = this.#serverTables[id].characters.characterId
        const iid = this.#serverTables[id].items.itemId;;
        const ichid = this.#serverTables[id].items.characterId;
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;

        let result = false;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            temporary = (await connectionGS.query("SELECT " + cchid + ", " + cusrnm + " FROM characters WHERE  " + cchnm + " = ? LIMIT 1;", [character]))[0][0];

            const charID = temporary[cchid];
            const charLogin = temporary[cusrnm];

            temporary = (await connectionLS.query("SELECT wallet_address FROM accounts WHERE " + ausrnm + " = ? LIMIT 1;", [charLogin]))[0][0];

            if (temporary.wallet_address === address) {

                temporary = (await connectionGS.query("SELECT SUM(" + iitam + ") AS balance FROM items WHERE " + iitmtyid + " = ? AND " + ichid + " = ? AND loc = 'inventory';", [this.#serverReward[id], charID]))[0][0];

                const charBalance = (temporary.balance != null) ? (temporary.balance) : (0);

                if (charBalance >= amount) {

                    let remainAmount = amount;
                    let index = 0;

                    temporary = (await connectionGS.query("SELECT " + iitam + ", " + iid + " FROM items WHERE  " + iitmtyid + " = ? AND " + ichid + " = ? AND loc = 'inventory';", [this.#serverReward[id], charID]))[0];

                    while (remainAmount > 0) {

                        const rowItemAmount = temporary[index][iitam];
                        const rowItemID = temporary[index][iid];

                        if (rowItemAmount == remainAmount && (await connectionGS.query("DELETE FROM items WHERE " + iid + " = ? LIMIT 1;", [rowItemID]))[0].affectedRows == 1)
                            remainAmount = 0;
                        else if (rowItemAmount > remainAmount && (await connectionGS.query("UPDATE items SET " + iitam + " = " + iitam + " - ? WHERE " + iid + " = ? LIMIT 1;", [remainAmount, rowItemID]))[0].changedRows == 1)
                            remainAmount = 0;
                        else if (((await connectionGS.query("DELETE FROM items WHERE " + iid + " = ? LIMIT 1;", [rowItemID]))[0]).affectedRows == 1)
                            remainAmount = remainAmount - rowItemAmount;
                        else
                            break;

                        index++;
                    }

                    if (remainAmount == 0)
                        result = true;
                }
                if (result == true && (await connectionLS.query("INSERT INTO fiskpay_temporary (server_id, character_id, amount, refund) VALUES (?, ?, ?, ?);", [id, character, amount, refund]))[0].affectedRows != 1)
                    result = false;
            }
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }
            else {

                await connectionLS.query("ROLLBACK;");
                await connectionGS.query("ROLLBACK;");
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    LOG_WITHDRAWAL = async (txHash, to, amount, id, character, refund) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const cchnm = this.#serverTables[id].characters.characterName;
        const cchid = this.#serverTables[id].characters.characterId

        let result = false;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            temporary = (await connectionGS.query("SELECT " + cchid + " FROM characters WHERE  " + cchnm + " = ? LIMIT 1;", [character]))[0][0];

            if ((await connectionLS.query("DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = ? AND amount = ? AND refund = ? LIMIT 1;", [id, temporary[cchid], amount, refund]))[0].affectedRows == 1)
                if ((await connectionLS.query("INSERT INTO fiskpay_withdrawals (server_id, transaction_hash, character_name, wallet_address, amount) VALUES (?, ?, ?, ?, ?);", [id, txHash, character, to, amount]))[0].affectedRows == 1)
                    result = true;
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }
            else {

                await connectionLS.query("ROLLBACK;");
                await connectionGS.query("ROLLBACK;");
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }

    REFUND_CHARACTERS = async (id) => {

        const connectionLS = await this.#serverConnections["ls"].getConnection();
        const connectionGS = await this.#serverConnections[id].getConnection();
        const iid = this.#serverTables[id].items.itemId;;
        const ichid = this.#serverTables[id].items.characterId;
        const iitmtyid = this.#serverTables[id].items.itemTypeId;
        const iitam = this.#serverTables[id].items.itemAmount;

        let result = false;
        let temporary;

        try {

            await connectionLS.query("SET autocommit = 0;");
            await connectionGS.query("SET autocommit = 0;");
            await connectionLS.query("START TRANSACTION;");
            await connectionGS.query("START TRANSACTION;");

            result = true;

            for (const row of ((await connectionLS.query("SELECT character_id, amount, refund FROM fiskpay_temporary WHERE  refund < ? AND server_id = ?", [Math.floor(Date.now() / 1000), id]))[0])) {

                const charID = row.character_id;
                const amount = row.amount;
                const refund = row.refund;

                temporary = (await connectionGS.query("SELECT " + iid + " FROM items WHERE  " + iitmtyid + " = ? AND loc = 'inventory' AND " + ichid + " = ? LIMIT 1;", [this.#serverReward[id], charID]))[0];

                if (temporary.length == 1) {

                    if (!((await connectionGS.query("UPDATE items SET " + iitam + " = " + iitam + " + ? WHERE " + iid + " = ? LIMIT 1;", [amount, temporary[0][iid]]))[0].changedRows == 1 && (await connectionLS.query("DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = ? AND amount = ? AND refund = ? LIMIT 1;", [id, charID, amount, refund]))[0].affectedRows == 1)) {

                        result = false;
                        break;
                    }
                }
                else {

                    let testID = 2100000000 + Math.floor(Math.random() * 9999900);

                    do {

                        testID++;
                        temporary = (await connectionGS.query("SELECT COUNT(" + iid + ") AS instances FROM items WHERE " + iid + " = ?;", [testID]))[0][0];
                        temporary = (temporary.instances != null) ? (temporary.instances) : (0);

                    } while (temporary > 0)

                    if (!((await connectionGS.query("INSERT INTO items (" + ichid + ", " + iid + ", " + iitmtyid + ", " + iitam + ", loc) VALUES (?, ?, ?, ?, 'inventory');", [charID, testID, this.#serverReward[id], amount]))[0].affectedRows == 1 && (await connectionLS.query("DELETE FROM fiskpay_temporary WHERE server_id = ? AND character_id = ? AND amount = ? AND refund = ? LIMIT 1;", [id, charID, amount, refund]))[0].affectedRows == 1)) {

                        result = false;
                        break;
                    }
                }
            };
        }
        catch (error) {

            result = false;

            this.emit("error", error);
        }
        finally {

            if (result === true) {

                await connectionLS.query("COMMIT;");
                await connectionGS.query("COMMIT;");
            }
            else {

                await connectionLS.query("ROLLBACK;");
                await connectionGS.query("ROLLBACK;");
            }

            connectionLS.release();
            connectionGS.release();

            return result;
        }
    }
}

module.exports = Connector;