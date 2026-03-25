// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * StealthWallet.sol
 * Multi-payment privacy wallet using Fhenix FHE CoFHE.
 * Amounts are genuinely encrypted on-chain.
 * Deployed on Fhenix CoFHE networks (e.g., Ethereum Sepolia).
 */
contract StealthWallet {

    // ─── Struct ────────────────────────────────────────────────────────────────

    struct Payment {
        uint256 id;
        euint64 encryptedAmount;  // Real FHE-encrypted amount
        uint256 unlockTime;
        address recipient;
        address sender;
        bool executed;
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    Payment[] public payments;

    // ─── Events ────────────────────────────────────────────────────────────────

    event PaymentScheduled(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 unlockTime
    );

    event PaymentExecuted(
        uint256 indexed id,
        address indexed recipient,
        uint256 amount
    );

    // ─── Functions ─────────────────────────────────────────────────────────────

    /**
     * @notice Schedule a private payment. Send ETH with this call.
     * @param _encryptedAmount  Real FHE-encrypted amount input
     * @param _unlockTime       Unix timestamp when payment becomes executable
     * @param _recipient        Address that will receive the ETH
     */
    function setPayment(
        InEuint64 calldata _encryptedAmount,
        uint256 _unlockTime,
        address _recipient
    ) external payable {
        require(msg.value > 0, "Must send ETH");
        require(_recipient != address(0), "Zero address recipient");
        require(_unlockTime > block.timestamp, "Unlock time must be in future");

        uint256 id = payments.length;

        // Convert the input to an encrypted type
        euint64 amount = FHE.asEuint64(_encryptedAmount);
        
        // Grant decryption access to the contract, the sender, and the recipient
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allow(amount, _recipient);

        payments.push(Payment({
            id: id,
            encryptedAmount: amount,
            unlockTime: _unlockTime,
            recipient: _recipient,
            sender: msg.sender,
            executed: false
        }));

        // Note: We don't emit the amount here to preserve privacy
        emit PaymentScheduled(id, msg.sender, _recipient, _unlockTime);
    }

    /**
     * @notice Initiates the async decryption of the payment amount.
     * MUST be called before executePayment, to unseal the FHE amount.
     */
    function requestDecryptAmount(uint256 _id) external {
        require(_id < payments.length, "Invalid payment ID");
        require(!payments[_id].executed, "Already executed");
        require(msg.sender == payments[_id].sender || msg.sender == payments[_id].recipient, "Not authorized");

        // FHE.decrypt triggers the decryption process via CoFHE
        FHE.decrypt(payments[_id].encryptedAmount);
    }

    /**
     * @notice Execute a payment by ID once its unlock time has passed and decryption is ready.
     * @param _id  The payment ID to execute
     */
    function executePayment(uint256 _id) external {
        require(_id < payments.length, "Invalid payment ID");

        Payment storage payment = payments[_id];
        require(msg.sender == payment.sender || msg.sender == payment.recipient, "Not authorized");
        require(!payment.executed, "Already executed");
        require(block.timestamp >= payment.unlockTime, "Payment still locked");

        // Get the decrypted value (this will revert if decryption isn't finished yet)
        (uint64 amount, bool decrypted) = FHE.getDecryptResultSafe(payment.encryptedAmount);
        require(decrypted, "Decryption not ready. Call requestDecryptAmount first");
        
        uint256 actualAmount = uint256(amount);
        require(address(this).balance >= actualAmount, "Insufficient contract balance");

        address payable recipient = payable(payment.recipient);

        // Checks-effects-interactions
        payment.executed = true;

        (bool success, ) = recipient.call{value: actualAmount}("");
        require(success, "ETH transfer failed");

        emit PaymentExecuted(_id, recipient, actualAmount);
    }

    /**
     * @notice Returns total number of payments.
     */
    function getPaymentCount() external view returns (uint256) {
        return payments.length;
    }

    /**
     * @notice Returns the ETH balance held in this contract.
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // We can't return an array of structs containing euint in Solidity directly.
    // Instead we provide a function to query single payments
    function getPaymentInfo(uint256 _id) external view returns (
        uint256 id,
        uint256 unlockTime,
        address recipient,
        address sender,
        bool executed
    ) {
        Payment storage p = payments[_id];
        return (p.id, p.unlockTime, p.recipient, p.sender, p.executed);
    }

    function getEncryptedAmount(uint256 _id) external view returns (euint64) {
        return payments[_id].encryptedAmount;
    }

    receive() external payable {}
}
