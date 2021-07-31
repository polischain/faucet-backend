const express = require('express');
const cors = require('cors')

const Web3 = require("web3");
const NodeCache = require("node-cache")

const cache = new NodeCache();
const cache_time = 60 * 60 * 24;

const PORT = process.env.PORT || 8080;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const web3_testnet = new Web3("https://sparta-rpc.polis.tech")

const account = web3_testnet.eth.accounts.privateKeyToAccount("0x" + PRIVATE_KEY)
web3_testnet.eth.accounts.wallet.add(account)
web3_testnet.defaultAccount = account.address;

const app = express();
app.use(express.json());
app.use(cors())

app.post('/', async (req, res) => {
    let body = req.body;
    let data = { network: body.network, address: Web3.utils.toChecksumAddress(body.address)}
    if (!data.network || data.network !== "mainnet" && data.network !== "testnet") {
        res.json({error: "Wrong network specified, please use mainnet or testnet"})
        return
    }

    if (!data.address || !Web3.utils.isAddress(data.address)) {
        res.json({error: "Wrong address. Please make sure you included the address and it is correctly formatted"})
        return
    }

    console.log("Coin request received for", data.network)

    let cached = cache.get(data.address)
    if (!cached) {
        let success = cache.set(data.address, Date.now(), cache_time);
        if (success) {
            switch (data.network) {
                case "mainnet":
                    res.json({error: "Mainnet is not supported yet"})
                    return
                case "testnet":
                    let tx = await web3_testnet.eth.sendTransaction({
                        from: account.address,
                        to: data.address,
                        value: Web3.utils.toWei("10", "ether"),
                        gas: "21000",
                        gasPrice: Web3.utils.toWei("0.1", "gwei")
                    })
                    res.json({data: tx.transactionHash})
                    return
            }
        } else {
            res.json({error: "Internal Error"})
        }
    } else {
        console.log("Address already received coins within period, ignoring...")
        let timestamp_release = cached + (cache_time * 1000);
        let timestamp_now = Date.now();
        let remaining = ((timestamp_release - timestamp_now) / 1000).toFixed(0);
        res.json({error: "Already received coins, wait " + secondsRender(remaining)})
    }
});

app.listen(PORT, () => {
    console.log(`Express listening on port:${PORT}`);
});

function secondsRender(d) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);
    let hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    let mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    let sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay;
}
