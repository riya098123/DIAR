
const CONTRACT_ADDRESS = "0xac92D99FF32728B142fD04C487AB9819075cC57F";
const DEPLOYMENT_BLOCK = 11996206;
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/alch_gZE3V7ByNVAlvnXoahHTt";
const CHUNK_SIZE = 10;

const ABI = [
    "event DiplomaIssued(bytes32 indexed diplomaId, bytes32 documentHash, address indexed issuer)",
    "function verifyDiploma(bytes32 diplomaId, bytes32 documentHash) view returns (bool exists, bool authentic, bool revoked, address issuer, uint256 issuedAt)"
];

function getDiplomaId() {
    const match = window.location.pathname.match(/\/verify\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function showStatus(message) {
    const el =
        document.getElementById("status") ||
        document.getElementById("verification-status") ||
        document.getElementById("result");

    if (el) el.textContent = message;
    else console.log(message);
}

function showDetails(message) {
    const el =
        document.getElementById("details") ||
        document.getElementById("verification-details");

    if (el) el.textContent = message;
    else console.log(message);
}

function formatError(error) {
    return (
        error?.shortMessage ||
        error?.reason ||
        error?.info?.error?.message ||
        error?.message ||
        "Unknown verification error."
    );
}

async function findDiplomaEvent(contract, diplomaIdBytes32, provider) {
    const latestBlock = await provider.getBlockNumber();
    const filter = contract.filters.DiplomaIssued(diplomaIdBytes32);

    for (
        let fromBlock = DEPLOYMENT_BLOCK;
        fromBlock <= latestBlock;
        fromBlock += CHUNK_SIZE
    ) {
        const toBlock = Math.min(
            fromBlock + CHUNK_SIZE - 1,
            latestBlock
        );

        let events;

        try {
            events = await contract.queryFilter(
                filter,
                fromBlock,
                toBlock
            );
        } catch (error) {
            console.error("Event query error:", error);

            throw new Error(
                `Could not search Sepolia blocks ${fromBlock}-${toBlock}. ` +
                "Check your RPC API key, deployment block and RPC limits."
            );
        }

        if (events.length > 0) {
            return events[events.length - 1];
        }
    }

    return null;
}

async function verifyDiploma() {
    try {
        showStatus("Checking diploma on Ethereum Sepolia...");
        showDetails("");

        if (!window.ethers) {
            throw new Error(
                "ethers.js is not loaded. Check verify.html script tags."
            );
        }

        if (!ethers.isAddress(CONTRACT_ADDRESS)) {
            throw new Error(
                "Invalid contract address. Check the deployed address."
            );
        }

        if (!Number.isSafeInteger(DEPLOYMENT_BLOCK) ||
            DEPLOYMENT_BLOCK < 0) {
            throw new Error("Invalid deployment block number.");
        }

        const diplomaId = getDiplomaId();

        if (!diplomaId) {
            throw new Error(
                "Diploma ID is missing from the verification URL."
            );
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const network = await provider.getNetwork();

        if (network.chainId !== 11155111n) {
            throw new Error(
                "Incorrect network. The RPC must connect to Sepolia."
            );
        }

        const code = await provider.getCode(CONTRACT_ADDRESS);

        if (code === "0x") {
            throw new Error(
                "No smart contract found at this address on Sepolia. " +
                "Check the contract address and network."
            );
        }

        const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            ABI,
            provider
        );

        const diplomaIdBytes32 = ethers.id(diplomaId);

        showStatus("Searching for the diploma registration event...");

        const event = await findDiplomaEvent(
            contract,
            diplomaIdBytes32,
            provider
        );

        if (!event) {
            throw new Error(
                "No DiplomaIssued event found for this ID. " +
                "Confirm that this diploma was issued on this contract " +
                "and that the deployment block is correct."
            );
        }

        const onChainHash = event.args.documentHash;

        const result = await contract.verifyDiploma(
            diplomaIdBytes32,
            onChainHash
        );

        const exists = result.exists;
        const authentic = result.authentic;
        const revoked = result.revoked;
        const issuer = result.issuer;
        const issuedAt = result.issuedAt;

        const issuedDate = Number(issuedAt)
            ? new Date(Number(issuedAt) * 1000).toLocaleString()
            : "Unavailable";

        if (!exists) {
            throw new Error(
                "The event was found, but the diploma record does not exist."
            );
        }

        if (revoked) {
            showStatus("REVOKED — This diploma has been revoked.");
            showDetails(
                `Diploma ID: ${diplomaId}\n` +
                `Issuer: ${issuer}\n` +
                `Issued at: ${issuedDate}`
            );
            return;
        }

        if (!authentic) {
            showStatus(
                "NOT AUTHENTIC — The contract did not confirm authenticity."
            );
            showDetails(`Diploma ID: ${diplomaId}\nIssuer: ${issuer}`);
            return;
        }

        showStatus("Blockchain record found. Checking PDF integrity...");

        const pdfUrl =
            `/diploma-file/${encodeURIComponent(diplomaId)}`;

        const pdfResponse = await fetch(pdfUrl, {
            cache: "no-store"
        });

        if (!pdfResponse.ok) {
            throw new Error(
                "Blockchain record found, but the PDF could not be retrieved. " +
                "Check the Flask /diploma-file route and saved PDF."
            );
        }

        const pdfBuffer = await pdfResponse.arrayBuffer();

        if (!window.crypto?.subtle) {
            throw new Error(
                "Secure SHA-256 hashing is unavailable. Open the application " +
                "through localhost or HTTPS."
            );
        }

        const digest = await crypto.subtle.digest(
            "SHA-256",
            pdfBuffer
        );

        const calculatedHash =
            "0x" +
            Array.from(new Uint8Array(digest))
                .map(byte => byte.toString(16).padStart(2, "0"))
                .join("");

        const hashMatches =
            calculatedHash.toLowerCase() === onChainHash.toLowerCase();

        if (hashMatches) {
            showStatus(
                "AUTHENTIC — PDF hash matches the blockchain record."
            );
        } else {
            showStatus(
                "NOT AUTHENTIC — PDF hash does not match the blockchain record."
            );
        }

        showDetails(
            `Diploma ID: ${diplomaId}\n` +
            `Blockchain: Ethereum Sepolia\n` +
            `Issuer: ${issuer}\n` +
            `Issued at: ${issuedDate}\n` +
            `On-chain SHA-256: ${onChainHash}\n` +
            `Calculated PDF SHA-256: ${calculatedHash}\n` +
            `Hash match: ${hashMatches ? "Yes" : "No"}\n` +
            `Transaction: ${event.transactionHash}`
        );

    } catch (error) {
        console.error("DIAR verification error:", error);
        showStatus("Verification failed");
        showDetails(formatError(error));
    }
}

window.addEventListener("DOMContentLoaded", verifyDiploma);
