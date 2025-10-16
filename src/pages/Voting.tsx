import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_ADDRESSES, apiBaseUrl } from "@/lib/config";
import { hexToBytes } from "@stacks/common";
import {
  bufferCV,
  uintCV,
} from "@stacks/transactions";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

interface DisputedQuestion {
  questionId: string;
  question: string;
  proposedAnswer: "YES" | "NO";
  proposer: string;
  yesVotes: number;
  noVotes: number;
  votingEnds: number;
  resolved: boolean;
  finalAnswer?: "YES" | "NO";
  userVote?: {
    vote: "YES" | "NO";
    stake: number;
    claimed: boolean;
  };
}

export function Voting() {
  const { userData, callContract } = useWallet();
  const address = userData?.addresses?.stx?.[0]?.address;
  const [selectedQuestion, setSelectedQuestion] =
    useState<DisputedQuestion | null>(null);
  const [voteChoice, setVoteChoice] = useState<"YES" | "NO">("YES");
  const [stakeAmount, setStakeAmount] = useState<string>("1000000");
  const [disputes, setDisputes] = useState<DisputedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch disputes from API
  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/oracle/disputes`);
        const data = await response.json();

        if (data.success && data.disputes) {
          // Transform API data to match DisputedQuestion interface
          const transformedDisputes: DisputedQuestion[] = data.disputes.map(
            (d: any) => ({
              questionId: d.questionId,
              question: d.question,
              proposedAnswer: d.proposedAnswer === 1 ? "YES" : "NO",
              proposer: d.proposer,
              yesVotes: d.yesVotes,
              noVotes: d.noVotes,
              votingEnds: d.votingEnds,
              resolved: d.resolved,
              finalAnswer:
                d.finalAnswer !== undefined
                  ? d.finalAnswer === 1
                    ? "YES"
                    : "NO"
                  : undefined,
            })
          );
          setDisputes(transformedDisputes);
        }
      } catch (error) {
        console.error("Error fetching disputes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDisputes();
  }, []);

  // Fetch user votes for each dispute if address is available
  useEffect(() => {
    if (!address || disputes.length === 0) return;

    const fetchUserVotes = async () => {
      const updatedDisputes = await Promise.all(
        disputes.map(async (dispute) => {
          try {
            const response = await fetch(
              `${apiBaseUrl}/api/oracle/questions/${dispute.questionId.replace(
                "0x",
                ""
              )}/vote/${address}`
            );
            const data = await response.json();

            if (data.success && data.vote) {
              return {
                ...dispute,
                userVote: {
                  vote: (data.vote.vote === 1 ? "YES" : "NO") as "YES" | "NO",
                  stake: data.vote.stake,
                  claimed: false, // Would need to check claim status separately
                },
              };
            }
          } catch (error) {
            console.error("Error fetching user vote:", error);
          }
          return dispute;
        })
      );
      setDisputes(updatedDisputes);
    };

    fetchUserVotes();
  }, [address, disputes.length]);

  const activeDisputes = disputes.filter((q) => !q.resolved);
  const resolvedDisputes = disputes.filter((q) => q.resolved);
  const claimableRewards = resolvedDisputes.filter(
    (q) => q.userVote && !q.userVote.claimed
  );

  const handleVote = async () => {
    if (!selectedQuestion || !address) return;

    try {
      const [contractAddress, contractName] = CONTRACT_ADDRESSES.OPTIMISTIC_ORACLE.split(".");

      const response = await callContract(
        contractAddress,
        contractName,
        "vote",
        [
          bufferCV(hexToBytes(selectedQuestion.questionId.slice(2))),
          uintCV(voteChoice === "YES" ? 1 : 0),
          uintCV(parseInt(stakeAmount)),
        ]
      );

      console.log("Vote submitted:", response);
      alert("Vote submitted! Transaction ID: " + response.txid);
    } catch (error) {
      console.error("Error voting:", error);
      alert("Error submitting vote: " + (error as Error).message);
    }
  };

  const handleClaimRewards = async (question: DisputedQuestion) => {
    if (!address) return;

    try {
      const [contractAddress, contractName] = CONTRACT_ADDRESSES.OPTIMISTIC_ORACLE.split(".");

      const response = await callContract(
        contractAddress,
        contractName,
        "claim-vote-rewards",
        [bufferCV(hexToBytes(question.questionId.slice(2)))]
      );

      console.log("Rewards claimed:", response);
      alert("Rewards claimed! Transaction ID: " + response.txid);
    } catch (error) {
      console.error("Error claiming rewards:", error);
      alert("Error claiming rewards: " + (error as Error).message);
    }
  };

  const calculatePotentialReward = (
    question: DisputedQuestion,
    vote: "YES" | "NO"
  ) => {
    const stake = parseInt(stakeAmount);
    const winningTotal = vote === "YES" ? question.yesVotes : question.noVotes;
    const losingTotal = vote === "YES" ? question.noVotes : question.yesVotes;

    if (winningTotal === 0) return stake;

    const rewardShare = Math.floor((stake * losingTotal) / winningTotal);
    return stake + rewardShare;
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-5xl font-bold tracking-tight">Voting Dashboard</h1>
        <p className="text-muted-foreground text-lg">
          Vote on disputed oracle questions, track your stakes, and claim
          rewards for correct votes.
        </p>
      </div>

      {!address && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
              Connect your wallet to vote and claim rewards
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Loading disputes...
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Active disputes" value={activeDisputes.length} />
          <StatCard label="Resolved disputes" value={resolvedDisputes.length} />
          <StatCard
            label="Claimable rewards"
            value={claimableRewards.length}
            highlight
          />
        </div>
      )}

      {claimableRewards.length > 0 && (
        <Card className="border-green-500/50 bg-green-500/5 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-600" />
              Claim Your Rewards
            </CardTitle>
            <CardDescription className="text-base">
              You have unclaimed rewards from resolved disputes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {claimableRewards.map((question) => {
                const didWin = question.userVote!.vote === question.finalAnswer;
                const stake = question.userVote!.stake;
                const winningTotal =
                  question.finalAnswer === "YES"
                    ? question.yesVotes
                    : question.noVotes;
                const losingTotal =
                  question.finalAnswer === "YES"
                    ? question.noVotes
                    : question.yesVotes;
                const rewardShare =
                  winningTotal > 0
                    ? Math.floor((stake * losingTotal) / winningTotal)
                    : 0;
                const totalReward = didWin ? stake + rewardShare : 0;

                return (
                  <div
                    key={question.questionId}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{question.question}</p>
                      <div className="mt-1 flex gap-2 text-sm text-muted-foreground">
                        <span>Your vote: {question.userVote!.vote}</span>
                        <span>•</span>
                        <span>
                          Stake:{" "}
                          {(question.userVote!.stake / 1_000_000).toFixed(2)}{" "}
                          sBTC
                        </span>
                        <span>•</span>
                        {didWin ? (
                          <span className="text-green-600 font-medium">
                            Reward: {(totalReward / 1_000_000).toFixed(2)} sBTC
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            Lost stake
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleClaimRewards(question)}
                      disabled={!address}
                      variant={didWin ? "default" : "outline"}
                    >
                      Claim {didWin ? "Rewards" : "Status"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Disputes</CardTitle>
            <CardDescription>
              Vote on disputed oracle proposals to earn rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Proposed</TableHead>
                  <TableHead>YES</TableHead>
                  <TableHead>NO</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDisputes.map((question) => (
                  <TableRow
                    key={question.questionId}
                    className={
                      selectedQuestion?.questionId === question.questionId
                        ? "bg-muted/50"
                        : ""
                    }
                  >
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm">
                        {question.question}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          question.proposedAnswer === "YES"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {question.proposedAnswer}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {(question.yesVotes / 1_000_000).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(question.noVotes / 1_000_000).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedQuestion(question)}
                      >
                        Vote
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {activeDisputes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No active disputes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cast Your Vote</CardTitle>
            <CardDescription>
              {selectedQuestion
                ? selectedQuestion.question
                : "Select a dispute to vote"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedQuestion ? (
              <>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="text-sm font-medium">Current Tally</div>
                  <div className="flex justify-between text-sm">
                    <span>
                      YES: {(selectedQuestion.yesVotes / 1_000_000).toFixed(2)}{" "}
                      sBTC
                    </span>
                    <span>
                      NO: {(selectedQuestion.noVotes / 1_000_000).toFixed(2)}{" "}
                      sBTC
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Proposed answer: {selectedQuestion.proposedAnswer}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Vote</label>
                  <div className="flex gap-2">
                    <Button
                      variant={voteChoice === "YES" ? "default" : "outline"}
                      onClick={() => setVoteChoice("YES")}
                      className="flex-1"
                    >
                      YES
                    </Button>
                    <Button
                      variant={voteChoice === "NO" ? "default" : "outline"}
                      onClick={() => setVoteChoice("NO")}
                      className="flex-1"
                    >
                      NO
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Stake Amount (micro-sBTC)
                  </label>
                  <Input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="1000000"
                  />
                  <p className="text-xs text-muted-foreground">
                    = {(parseInt(stakeAmount) / 1_000_000).toFixed(2)} sBTC
                  </p>
                </div>

                <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-4">
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Potential Reward
                  </div>
                  <div className="text-2xl font-bold">
                    {(
                      calculatePotentialReward(selectedQuestion, voteChoice) /
                      1_000_000
                    ).toFixed(2)}{" "}
                    sBTC
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    If {voteChoice} wins. Losers forfeit their stake.
                  </div>
                </div>

                <Button
                  onClick={handleVote}
                  disabled={!address || !stakeAmount}
                  className="w-full"
                >
                  Submit Vote
                </Button>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select a dispute from the table to cast your vote
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resolved Disputes</CardTitle>
          <CardDescription>Historical voting outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Proposed</TableHead>
                <TableHead>Final Answer</TableHead>
                <TableHead>Your Vote</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolvedDisputes.map((question) => (
                <TableRow key={question.questionId}>
                  <TableCell className="max-w-xs truncate">
                    {question.question}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{question.proposedAnswer}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{question.finalAnswer}</Badge>
                  </TableCell>
                  <TableCell>
                    {question.userVote ? (
                      <Badge
                        variant={
                          question.userVote.vote === question.finalAnswer
                            ? "default"
                            : "destructive"
                        }
                      >
                        {question.userVote.vote}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No vote
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {question.userVote && !question.userVote.claimed && (
                      <Badge variant="outline" className="text-green-600">
                        Claimable
                      </Badge>
                    )}
                    {question.userVote?.claimed && (
                      <Badge variant="secondary">Claimed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {resolvedDisputes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No resolved disputes yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  highlight?: boolean;
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <Card className={highlight ? "border-green-500/50 bg-green-500/5" : ""}>
      <CardHeader className="space-y-1">
        <CardDescription className="uppercase text-xs tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
