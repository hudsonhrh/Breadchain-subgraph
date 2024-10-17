import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  Transfer,
  Minted,
  Burned,
  ClaimedYield,
  DelegateChanged,
  DelegateVotesChanged,
} from "../generated/Bread/Bread";
import {
  BreadToken,
  User,
  TransferEvent,
  MintEvent,
  BurnEvent,
  ClaimedYieldEvent,
  DelegationEvent,
} from "../generated/schema";
import { Bread } from "../generated/Bread/Bread";

// Define the burn address
const BURN_ADDRESS = "0x0000000000000000000000000000000000000000";

function loadOrCreateUser(userId: string): User {
  let user = User.load(userId);
  if (user == null) {
    user = new User(userId);
    user.balance = BigInt.zero();
    user.totalSent = BigInt.zero();
    user.totalReceived = BigInt.zero();
    user.totalMinted = BigInt.zero();
    user.totalBurned = BigInt.zero();
    user.totalYieldClaimed = BigInt.zero();
    user.transactionCount = 0;
    user.votesDelegated = BigInt.zero();
    user.delegatesTo = null;
  }
  return user;
}

function loadOrCreateBreadToken(tokenId: string): BreadToken {
  let breadToken = BreadToken.load(tokenId);
  if (breadToken == null) {
    breadToken = new BreadToken(tokenId);
    breadToken.totalSupply = BigInt.zero();
    breadToken.totalMinted = BigInt.zero();
    breadToken.totalBurned = BigInt.zero();
    breadToken.totalYieldClaimed = BigInt.zero();
    breadToken.totalDelegatedVotes = BigInt.zero();

    let contract = Bread.bind(Address.fromString(tokenId));
    let nameResult = contract.try_name();
    let symbolResult = contract.try_symbol();
    let yieldClaimerResult = contract.try_yieldClaimer();

    if (!nameResult.reverted) breadToken.name = nameResult.value;
    else breadToken.name = "";
    if (!symbolResult.reverted) breadToken.symbol = symbolResult.value;
    else breadToken.symbol = "";
    if (!yieldClaimerResult.reverted)
      breadToken.yieldClaimer = yieldClaimerResult.value;
    else breadToken.yieldClaimer = Address.zero();
  }
  return breadToken;
}

export function handleTransfer(event: Transfer): void {
  let fromAddress = event.params.from.toHex();
  let toAddress = event.params.to.toHex();
  let amount = event.params.value;
  let tokenAddress = event.address.toHex();

  let breadToken = loadOrCreateBreadToken(tokenAddress);

  let fromIsBurn = fromAddress == BURN_ADDRESS;
  let toIsBurn = toAddress == BURN_ADDRESS;

  // Adjust totalSupply based on minting or burning
  if (fromIsBurn) {
    // Minting
    breadToken.totalSupply = breadToken.totalSupply.plus(amount);
    breadToken.totalMinted = breadToken.totalMinted.plus(amount);
    breadToken.save();

    // Load or create toUser
    let toUser = loadOrCreateUser(toAddress);
    // Update toUser
    toUser.balance = toUser.balance.plus(amount);
    toUser.totalReceived = toUser.totalReceived.plus(amount);
    toUser.totalMinted = toUser.totalMinted.plus(amount);
    toUser.transactionCount += 1;
    toUser.save();

    // Create MintEvent entity
    let mintEvent = new MintEvent(
      event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    );
    mintEvent.receiver = toUser.id;
    mintEvent.amount = amount;
    mintEvent.blockNumber = event.block.number;
    mintEvent.timestamp = event.block.timestamp;
    mintEvent.transactionHash = event.transaction.hash;
    mintEvent.token = tokenAddress;
    mintEvent.save();
  } else if (toIsBurn) {
    // Burning
    breadToken.totalSupply = breadToken.totalSupply.minus(amount);
    breadToken.totalBurned = breadToken.totalBurned.plus(amount);
    breadToken.save();

    // Load or create fromUser
    let fromUser = loadOrCreateUser(fromAddress);
    // Update fromUser
    fromUser.balance = fromUser.balance.minus(amount);
    fromUser.totalSent = fromUser.totalSent.plus(amount);
    fromUser.totalBurned = fromUser.totalBurned.plus(amount);
    fromUser.transactionCount += 1;
    fromUser.save();

    // Create BurnEvent entity
    let burnEvent = new BurnEvent(
      event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    );
    burnEvent.receiver = fromUser.id;
    burnEvent.amount = amount;
    burnEvent.blockNumber = event.block.number;
    burnEvent.timestamp = event.block.timestamp;
    burnEvent.transactionHash = event.transaction.hash;
    burnEvent.token = tokenAddress;
    burnEvent.save();
  } else {
    // Regular transfer
    // Load or create fromUser and toUser
    let fromUser = loadOrCreateUser(fromAddress);
    let toUser = loadOrCreateUser(toAddress);

    fromUser.balance = fromUser.balance.minus(amount);
    fromUser.totalSent = fromUser.totalSent.plus(amount);
    fromUser.transactionCount += 1;
    fromUser.save();

    toUser.balance = toUser.balance.plus(amount);
    toUser.totalReceived = toUser.totalReceived.plus(amount);
    toUser.transactionCount += 1;
    toUser.save();
  }

  // Create TransferEvent entity
  let transferEvent = new TransferEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  transferEvent.from = fromIsBurn ? null : fromAddress;
  transferEvent.to = toIsBurn ? null : toAddress;
  transferEvent.amount = amount;
  transferEvent.blockNumber = event.block.number;
  transferEvent.timestamp = event.block.timestamp;
  transferEvent.transactionHash = event.transaction.hash;
  transferEvent.logIndex = event.logIndex;
  transferEvent.token = tokenAddress;

  // Save TransferEvent entity
  transferEvent.save();
}

export function handleMinted(event: Minted): void {
  // Since minting is handled in handleTransfer, we don't adjust totalSupply here
  let receiverAddress = event.params.receiver.toHex();
  let amount = event.params.amount;
  let tokenAddress = event.address.toHex();

  // Load or create User entity
  let user = loadOrCreateUser(receiverAddress);

  // Update totalMinted for the user
  user.totalMinted = user.totalMinted.plus(amount);
  user.save();

  // Create MintEvent entity
  let mintEvent = new MintEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  mintEvent.receiver = user.id;
  mintEvent.amount = amount;
  mintEvent.blockNumber = event.block.number;
  mintEvent.timestamp = event.block.timestamp;
  mintEvent.transactionHash = event.transaction.hash;
  mintEvent.token = tokenAddress;
  mintEvent.save();
}

export function handleBurned(event: Burned): void {
  // Since burning is handled in handleTransfer, we don't adjust totalSupply here
  let receiverAddress = event.params.receiver.toHex();
  let amount = event.params.amount;
  let tokenAddress = event.address.toHex();

  // Load or create User entity
  let user = loadOrCreateUser(receiverAddress);

  // Update totalBurned for the user
  user.totalBurned = user.totalBurned.plus(amount);
  user.save();

  // Create BurnEvent entity
  let burnEvent = new BurnEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  burnEvent.receiver = user.id;
  burnEvent.amount = amount;
  burnEvent.blockNumber = event.block.number;
  burnEvent.timestamp = event.block.timestamp;
  burnEvent.transactionHash = event.transaction.hash;
  burnEvent.token = tokenAddress;
  burnEvent.save();
}

export function handleClaimedYield(event: ClaimedYield): void {
  let amount = event.params.amount;
  let tokenAddress = event.address.toHex();
  let receiverAddress = event.transaction.from.toHex(); // Assuming the caller is the receiver

  // Load or create User entity
  let user = loadOrCreateUser(receiverAddress);

  // Update balance and totalYieldClaimed
  user.balance = user.balance.plus(amount);
  user.totalYieldClaimed = user.totalYieldClaimed.plus(amount);
  user.transactionCount += 1;
  user.save();

  // Create ClaimedYieldEvent entity
  let claimedYieldEvent = new ClaimedYieldEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  claimedYieldEvent.receiver = user.id;
  claimedYieldEvent.amount = amount;
  claimedYieldEvent.blockNumber = event.block.number;
  claimedYieldEvent.timestamp = event.block.timestamp;
  claimedYieldEvent.transactionHash = event.transaction.hash;
  claimedYieldEvent.token = tokenAddress;

  claimedYieldEvent.save();

  // Load or create BreadToken entity
  let breadToken = loadOrCreateBreadToken(tokenAddress);

  // Update totalYieldClaimed
  breadToken.totalYieldClaimed = breadToken.totalYieldClaimed.plus(amount);

  // Save BreadToken entity
  breadToken.save();
}

export function handleDelegateChanged(event: DelegateChanged): void {
  let delegatorAddress = event.params.delegator.toHex();
  let fromDelegateAddress = event.params.fromDelegate.toHex();
  let toDelegateAddress = event.params.toDelegate.toHex();
  let tokenAddress = event.address.toHex();

  // Load or create User entities
  let delegatorUser = loadOrCreateUser(delegatorAddress);
  let toDelegateUser = loadOrCreateUser(toDelegateAddress);
  let fromDelegateUser = loadOrCreateUser(fromDelegateAddress);

  // Update delegator's delegatesTo field
  delegatorUser.delegatesTo = toDelegateUser.id;
  delegatorUser.save();

  // Create DelegationEvent entity
  let delegationEvent = new DelegationEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  delegationEvent.delegator = delegatorUser.id;
  delegationEvent.delegatee = toDelegateUser.id;
  delegationEvent.previousDelegatee = fromDelegateUser.id;
  delegationEvent.blockNumber = event.block.number;
  delegationEvent.timestamp = event.block.timestamp;
  delegationEvent.transactionHash = event.transaction.hash;
  delegationEvent.token = tokenAddress;

  delegationEvent.save();
}

export function handleDelegateVotesChanged(event: DelegateVotesChanged): void {
  let delegateAddress = event.params.delegate.toHex();
  let newVotes = event.params.newVotes;
  let previousVotes = event.params.previousVotes;
  let tokenAddress = event.address.toHex();

  let delegateUser = loadOrCreateUser(delegateAddress);

  // Update votesDelegated
  delegateUser.votesDelegated = newVotes;
  delegateUser.save();

  // Load or create BreadToken entity
  let breadToken = loadOrCreateBreadToken(tokenAddress);

  // Update totalDelegatedVotes
  breadToken.totalDelegatedVotes = breadToken.totalDelegatedVotes.plus(
    newVotes.minus(previousVotes)
  );

  breadToken.save();
}
