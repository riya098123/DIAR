
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DIAR {
    address public owner;

    struct Diploma {
        bytes32 documentHash;
        address issuer;
        uint256 issuedAt;
        bool exists;
        bool revoked;
    }

    mapping(bytes32 => Diploma) private diplomas;
    mapping(address => bool) public authorizedIssuers;

    event DiplomaIssued(
        bytes32 indexed diplomaId,
        bytes32 documentHash,
        address indexed issuer
    );

    event DiplomaRevoked(
        bytes32 indexed diplomaId,
        address indexed revokedBy
    );

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    modifier onlyIssuer() {
        require(
            authorizedIssuers[msg.sender],
            "Not an authorized issuer"
        );
        _;
    }

    function authorizeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid address");
        authorizedIssuers[issuer] = true;
    }

    function issueDiploma(
        bytes32 diplomaId,
        bytes32 documentHash
    ) external onlyIssuer {
        require(diplomaId != bytes32(0), "Invalid diploma ID");
        require(documentHash != bytes32(0), "Invalid document hash");
        require(!diplomas[diplomaId].exists, "Diploma ID already used");

        diplomas[diplomaId] = Diploma({
            documentHash: documentHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            exists: true,
            revoked: false
        });

        emit DiplomaIssued(diplomaId, documentHash, msg.sender);
    }

    function verifyDiploma(
        bytes32 diplomaId,
        bytes32 documentHash
    ) external view returns (
        bool exists,
        bool authentic,
        bool revoked,
        address issuer,
        uint256 issuedAt
    ) {
        Diploma memory d = diplomas[diplomaId];

        exists = d.exists;
        authentic = d.exists &&
                    d.documentHash == documentHash &&
                    !d.revoked;
        revoked = d.revoked;
        issuer = d.issuer;
        issuedAt = d.issuedAt;
    }

    function revokeDiploma(bytes32 diplomaId) external onlyOwner {
        require(diplomas[diplomaId].exists, "Diploma not found");
        require(!diplomas[diplomaId].revoked, "Already revoked");

        diplomas[diplomaId].revoked = true;
        emit DiplomaRevoked(diplomaId, msg.sender);
    }
}
