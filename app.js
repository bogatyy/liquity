const LUSD_TOKEN_ADDRESS = '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0';
const LUSD_TOKEN_ABI = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

const TROVE_MANAGER_ADDRESS = '0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2';
const TROVE_MANAGER_ABI = [{"constant":false,"inputs":[{"name":"_LUSDamount","type":"uint256"},{"name":"_firstRedemptionHint","type":"address"},{"name":"_upperPartialRedemptionHint","type":"address"},{"name":"_lowerPartialRedemptionHint","type":"address"},{"name":"_partialRedemptionHintNICR","type":"uint256"},{"name":"_maxIterations","type":"uint256"},{"name":"_maxFeePercentage","type":"uint256"}],"name":"redeemCollateral","outputs":[],"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getRedemptionRateWithDecay","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]

const LIQUITY_PRICE_FEED_ADDRESS = '0x4c517D4e2C851CA76d7eC94B805269Df0f2201De';
const LIQUITY_PRICE_FEED_ABI = [{"constant":true,"inputs":[],"name":"fetchPrice","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

const HINT_HELPERS_ADDRESS = '0xE84251b93D9524E0d2e621Ba7dc7cb3579F997C0';
const HINT_HELPERS_ABI = [{"inputs":[{"internalType":"uint256","name":"_LUSDamount","type":"uint256"},{"internalType":"uint256","name":"_price","type":"uint256"},{"internalType":"uint256","name":"_maxIterations","type":"uint256"}],"name":"getRedemptionHints","outputs":[{"internalType":"address","name":"firstRedemptionHint","type":"address"},{"internalType":"uint256","name":"partialRedemptionHintNICR","type":"uint256"},{"internalType":"uint256","name":"truncatedLUSDamount","type":"uint256"}],"stateMutability":"view","type":"function"}];

// Head = largest NICT = collateral/debt = safe
// Need hint to avoid full list iteration!
// upperHint = prevID, lowerHint = nextID
// NCR(prevID) > NCR(insertion) > NCR(nextID) – that's ranking in list, safe first
const SORTED_TROVES_ADDRESS = '0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6';
const SORTED_TROVES_ABI = [{"inputs":[{"internalType":"uint256","name":"_NICR","type":"uint256"},{"internalType":"address","name":"_prevId","type":"address"},{"internalType":"address","name":"_nextId","type":"address"}],"name":"findInsertPosition","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

const MAX_ITERATIONS = 5;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let web3;
let userAccount;
let lusdToken;
let troveManager;
let liquityPriceFeed;
let hintHelpers;
let sortedTroves;
let lusdTotalSupply;
let redemptionRate;

window.addEventListener('load', async () => {
    if (typeof window.ethereum !== 'undefined') {
        console.log('MetaMask is installed!');
        web3 = new Web3(window.ethereum);
        lusdToken = new web3.eth.Contract(LUSD_TOKEN_ABI, LUSD_TOKEN_ADDRESS);
        troveManager = new web3.eth.Contract(TROVE_MANAGER_ABI, TROVE_MANAGER_ADDRESS);
        liquityPriceFeed = new web3.eth.Contract(LIQUITY_PRICE_FEED_ABI, LIQUITY_PRICE_FEED_ADDRESS);
        hintHelpers = new web3.eth.Contract(HINT_HELPERS_ABI, HINT_HELPERS_ADDRESS);
        sortedTroves = new web3.eth.Contract(SORTED_TROVES_ABI, SORTED_TROVES_ADDRESS);
        lusdTotalSupply = new web3.utils.BN(await lusdToken.methods.totalSupply().call());
        redemptionRate = new web3.utils.BN(await troveManager.methods.getRedemptionRateWithDecay().call());
        // Check if accounts are already connected
        const accounts = await web3.eth.getAccounts();
        if (accounts.length > 0) {
            userAccount = accounts[0];
        }
    } else {
        alert("Please install or enable MetaMask.");
    }
});

document.getElementById('connectWallet').addEventListener('click', async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            // Request user's accounts
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAccount = accounts[0];
        } catch (error) {
            console.error('User denied account access');
        }
    } else {
        alert("Please install or enable MetaMask.");
    }
});

document.getElementById('checkLUSDBalance').addEventListener('click', async () => {
    if (userAccount) {
        const balanceWei = await lusdToken.methods.balanceOf(userAccount).call();
        const balance = web3.utils.fromWei(balanceWei, 'ether');
        document.getElementById('lusdBalance').innerText = `LUSD Balance: ${balance}`;
    }
});

document.getElementById('redeemAmount').addEventListener('input', async () => {
    if (userAccount) {
        const redeemAmount = new web3.utils.BN(web3.utils.toWei(document.getElementById('redeemAmount').value, 'ether'));
        const extraRate = redeemAmount.mul(new web3.utils.BN(web3.utils.toWei('0.5', 'ether'))).div(lusdTotalSupply);
        console.log(`Current rate ${redemptionRate} plus our extra ${extraRate}`);
        const maxFee = (parseFloat(web3.utils.fromWei(redemptionRate.add(extraRate), 'ether')) * 100.0 + 0.002).toFixed(3);
        document.getElementById('maxFee').value = maxFee;
    }
});

document.getElementById('redeemLUSD').addEventListener('click', async () => {
    if (userAccount) {
        const redeemAmount = web3.utils.toWei(document.getElementById('redeemAmount').value, 'ether');
        try {
            const price = await liquityPriceFeed.methods.fetchPrice().call();
            console.log(`Fetched price: ${price}`);

            const hints = await hintHelpers.methods.getRedemptionHints(redeemAmount, price, MAX_ITERATIONS).call();
            const firstRedemptionHint = hints[0];
            const partialRedemptionHintNICR = hints[1];
            const truncatedLUSDamount = hints[2];            
            console.log(`First Redemption Hint: ${firstRedemptionHint}`);
            console.log(`Partial Redemption Hint NICR: ${partialRedemptionHintNICR}`);
            console.log(`Truncated LUSD Amount: ${truncatedLUSDamount}`);

            const prevAndNext = await sortedTroves.methods.findInsertPosition(partialRedemptionHintNICR, ZERO_ADDRESS, ZERO_ADDRESS).call()
            const prevPositionHint = prevAndNext[0];
            console.log(`Inserting after Trove: ${prevPositionHint}`);

            const maxFeePercentage = web3.utils.toWei(document.getElementById('maxFee').value, 'ether');
            console.log(`Max acceptable fee percentage set to: ${maxFeePercentage}`);

            await troveManager.methods.redeemCollateral(truncatedLUSDamount, firstRedemptionHint, prevPositionHint, ZERO_ADDRESS,
                    partialRedemptionHintNICR, MAX_ITERATIONS, maxFeePercentage).send({ from: userAccount });      

            document.getElementById('transactionStatus').innerText = "Redemption successful!";
        } catch (error) {
            document.getElementById('transactionStatus').innerText = "Redemption failed!";
            console.error(error);
        }
    }
});
