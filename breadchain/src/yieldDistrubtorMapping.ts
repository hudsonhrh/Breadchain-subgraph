import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  YieldDistributed,
  BreadHolderVoted,
} from "../generated/YieldDistributor/YieldDistributor";
import {
  User,
  VoteEvent,
  YieldDistributionEvent,
} from "../generated/schema";

// Helper function to load or create a User
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

    // Initialize voter-related fields
    user.votes = BigInt.zero();
    user.lastVotedBlock = BigInt.zero();
    user.distributions = new Array<BigInt>();
  }
  return user;
}

export function handleYieldDistributed(event: YieldDistributed): void {
  let entity = new YieldDistributionEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  entity.totalYield = event.params.yieldAmount; 
  entity.totalVotes = event.params.totalVotes;
  entity.projectDistributions = event.params.projectDistributions.map<BigInt>(
    (distribution) => distribution
  );
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleBreadHolderVoted(event: BreadHolderVoted): void {
  let voterAddress = event.params.account.toHex();
  let user = loadOrCreateUser(voterAddress);

  // Ensure user.distributions is initialized
  if (user.distributions == null) {
    user.distributions = new Array<BigInt>();
  } else {
    // Clear the array if it already exists
    user.distributions.length = 0;
  }

  user.lastVotedBlock = event.block.number;
  user.transactionCount = user.transactionCount + 1; // Use explicit addition
  user.save();

  // Create a new VoteEvent
  let voteEvent = new VoteEvent(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  voteEvent.voter = user.id;
  voteEvent.points = event.params.points.map<BigInt>((point) => point);
  voteEvent.projects = event.params.projects.map<Bytes>((project) =>
    project as Bytes
  );
  voteEvent.blockNumber = event.block.number;
  voteEvent.timestamp = event.block.timestamp;
  voteEvent.transactionHash = event.transaction.hash;

  voteEvent.save();
}
