
const CONTRACT_ADDRESS = "0xac92D99FF32728B142fD04C487AB9819075cC57F";
const SEPOLIA_CHAIN_ID = 11155111;

const ABI = [
    "function authorizedIssuers(address) view returns (bool)",
    "function issueDiploma(bytes32 diplomaId, bytes32 documentHash)"
];

const button = document.getElementById("registerDiploma");
const statusBox = document.getElementById("blockchainStatus");

if (button && statusBox) {
    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            if (!window.ethereum) {
                throw new Error("Please install or enable MetaMask.");
            }

            if (!window.ethers) {
                throw new Error("ethers.js failed to load.");
            }

            if (
                !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) ||
                CONTRACT_ADDRESS.includes("PASTE_YOUR")
            ) {
                throw new Error("Set the full DIAR contract address.");
            }

            statusBox.textContent = "Connecting to MetaMask...";

            const provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);

            const network = await provider.getNetwork();

            if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
                throw new Error("Switch MetaMask to Ethereum Sepolia.");
            }

            const signer = await provider.getSigner();
            const wallet = await signer.getAddress();

            const contract = new ethers.Contract(
                CONTRACT_ADDRESS, ABI, signer
            );

            const authorized = await contract.authorizedIssuers(wallet);

            if (!authorized) {
                throw new Error(
                    "This wallet is not an authorized issuer."
                );
            }

            const diplomaId = button.dataset.diplomaId.trim();
            const hash = button.dataset.documentHash.trim().toLowerCase();

            if (!/^[0-9a-f]{64}$/.test(hash)) {
                throw new Error("PDF SHA-256 must contain 64 hexadecimal characters.");
            }

            const idBytes32 = ethers.id(diplomaId);
            const hashBytes32 = "0x" + hash;

            statusBox.textContent =
                "Confirm the transaction in MetaMask...";

            const tx = await contract.issueDiploma(
                idBytes32, hashBytes32
            );

            statusBox.textContent =
                "Transaction submitted. Waiting for confirmation...";

            await tx.wait();

            statusBox.textContent =
                "Diploma registered successfully. Transaction: " + tx.hash;

        } catch (error) {
            console.error(error);
            statusBox.textContent =
                error.shortMessage || error.reason ||
                error.message || "Registration failed.";
        } finally {
            button.disabled = false;
        }
    });
}
