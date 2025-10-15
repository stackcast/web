import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWallet } from '@/contexts/WalletContext'
import { CONTRACT_ADDRESSES } from '@/lib/config'
import { openContractCall } from '@stacks/connect'
import {
  uintCV,
  bufferCV,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions'

interface DisputedQuestion {
  questionId: string
  question: string
  proposedAnswer: 'YES' | 'NO'
  proposer: string
  yesVotes: number
  noVotes: number
  votingEnds: number
  resolved: boolean
  finalAnswer?: 'YES' | 'NO'
  userVote?: {
    vote: 'YES' | 'NO'
    stake: number
    claimed: boolean
  }
}

// Mock data - in production, fetch from contract/API
const mockDisputedQuestions: DisputedQuestion[] = [
  {
    questionId: '0x0101010101010101010101010101010101010101010101010101010101010101',
    question: 'Will ETH hit $10k by Dec 31, 2025?',
    proposedAnswer: 'YES',
    proposer: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
    yesVotes: 2000000,
    noVotes: 500000,
    votingEnds: 1234567890,
    resolved: false,
  },
  {
    questionId: '0x0202020202020202020202020202020202020202020202020202020202020202',
    question: 'Will BTC hit $150k by end of 2025?',
    proposedAnswer: 'NO',
    proposer: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
    yesVotes: 3000000,
    noVotes: 1000000,
    votingEnds: 1234567800,
    resolved: true,
    finalAnswer: 'YES',
    userVote: {
      vote: 'YES',
      stake: 1000000,
      claimed: false,
    },
  },
]

export function Voting() {
  const { userData } = useWallet()
  const address = userData?.addresses?.stx?.[0]?.address
  const [selectedQuestion, setSelectedQuestion] = useState<DisputedQuestion | null>(null)
  const [voteChoice, setVoteChoice] = useState<'YES' | 'NO'>('YES')
  const [stakeAmount, setStakeAmount] = useState<string>('1000000')

  const activeDisputes = mockDisputedQuestions.filter(q => !q.resolved)
  const resolvedDisputes = mockDisputedQuestions.filter(q => q.resolved)
  const claimableRewards = resolvedDisputes.filter(q => q.userVote && !q.userVote.claimed)

  const handleVote = async () => {
    if (!selectedQuestion || !address) return

    try {
      openContractCall({
        network: 'devnet' as any,
        anchorMode: AnchorMode.Any,
        contractAddress: CONTRACT_ADDRESSES.OPTIMISTIC_ORACLE.split('.')[0],
        contractName: CONTRACT_ADDRESSES.OPTIMISTIC_ORACLE.split('.')[1],
        functionName: 'vote',
        functionArgs: [
          bufferCV(Buffer.from(selectedQuestion.questionId.slice(2), 'hex')),
          uintCV(voteChoice === 'YES' ? 1 : 0),
          uintCV(parseInt(stakeAmount)),
        ],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Vote submitted:', data)
          alert('Vote submitted! Transaction ID: ' + data.txId)
        },
        onCancel: () => {
          console.log('Vote cancelled')
        },
      })
    } catch (error) {
      console.error('Error voting:', error)
      alert('Error submitting vote: ' + (error as Error).message)
    }
  }

  const handleClaimRewards = async (question: DisputedQuestion) => {
    if (!address) return

    try {
      openContractCall({
        network: 'devnet' as any,
        anchorMode: AnchorMode.Any,
        contractAddress: CONTRACT_ADDRESSES.OPTIMISTIC_ORACLE.split('.')[0],
        contractName: CONTRACT_ADDRESSES.OPTIMISTIC_ORACLE.split('.')[1],
        functionName: 'claim-vote-rewards',
        functionArgs: [
          bufferCV(Buffer.from(question.questionId.slice(2), 'hex')),
        ],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Rewards claimed:', data)
          alert('Rewards claimed! Transaction ID: ' + data.txId)
        },
        onCancel: () => {
          console.log('Claim cancelled')
        },
      })
    } catch (error) {
      console.error('Error claiming rewards:', error)
      alert('Error claiming rewards: ' + (error as Error).message)
    }
  }

  const calculatePotentialReward = (question: DisputedQuestion, vote: 'YES' | 'NO') => {
    const stake = parseInt(stakeAmount)
    const winningTotal = vote === 'YES' ? question.yesVotes : question.noVotes
    const losingTotal = vote === 'YES' ? question.noVotes : question.yesVotes

    if (winningTotal === 0) return stake

    const rewardShare = Math.floor((stake * losingTotal) / winningTotal)
    return stake + rewardShare
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Voting Dashboard</h1>
        <p className="text-muted-foreground">
          Vote on disputed oracle questions, track your stakes, and claim rewards for correct votes.
        </p>
      </div>

      {!address && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Connect your wallet to vote and claim rewards
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active disputes" value={activeDisputes.length} />
        <StatCard label="Resolved disputes" value={resolvedDisputes.length} />
        <StatCard label="Claimable rewards" value={claimableRewards.length} highlight />
      </div>

      {claimableRewards.length > 0 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle>🎉 Claim Your Rewards</CardTitle>
            <CardDescription>You have unclaimed rewards from resolved disputes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {claimableRewards.map((question) => {
                const didWin = question.userVote!.vote === question.finalAnswer
                const stake = question.userVote!.stake
                const winningTotal = question.finalAnswer === 'YES' ? question.yesVotes : question.noVotes
                const losingTotal = question.finalAnswer === 'YES' ? question.noVotes : question.yesVotes
                const rewardShare = winningTotal > 0 ? Math.floor((stake * losingTotal) / winningTotal) : 0
                const totalReward = didWin ? stake + rewardShare : 0

                return (
                  <div key={question.questionId} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <p className="font-medium">{question.question}</p>
                      <div className="mt-1 flex gap-2 text-sm text-muted-foreground">
                        <span>Your vote: {question.userVote!.vote}</span>
                        <span>•</span>
                        <span>Stake: {(question.userVote!.stake / 1_000_000).toFixed(2)} sBTC</span>
                        <span>•</span>
                        {didWin ? (
                          <span className="text-green-600 font-medium">
                            Reward: {(totalReward / 1_000_000).toFixed(2)} sBTC
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">Lost stake</span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleClaimRewards(question)}
                      disabled={!address}
                      variant={didWin ? 'default' : 'outline'}
                    >
                      Claim {didWin ? 'Rewards' : 'Status'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Disputes</CardTitle>
            <CardDescription>Vote on disputed oracle proposals to earn rewards</CardDescription>
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
                    className={selectedQuestion?.questionId === question.questionId ? 'bg-muted/50' : ''}
                  >
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm">{question.question}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={question.proposedAnswer === 'YES' ? 'default' : 'secondary'}>
                        {question.proposedAnswer}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{(question.yesVotes / 1_000_000).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">{(question.noVotes / 1_000_000).toFixed(2)}</TableCell>
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
              {selectedQuestion ? selectedQuestion.question : 'Select a dispute to vote'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedQuestion ? (
              <>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="text-sm font-medium">Current Tally</div>
                  <div className="flex justify-between text-sm">
                    <span>YES: {(selectedQuestion.yesVotes / 1_000_000).toFixed(2)} sBTC</span>
                    <span>NO: {(selectedQuestion.noVotes / 1_000_000).toFixed(2)} sBTC</span>
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
                      variant={voteChoice === 'YES' ? 'default' : 'outline'}
                      onClick={() => setVoteChoice('YES')}
                      className="flex-1"
                    >
                      YES
                    </Button>
                    <Button
                      variant={voteChoice === 'NO' ? 'default' : 'outline'}
                      onClick={() => setVoteChoice('NO')}
                      className="flex-1"
                    >
                      NO
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Stake Amount (micro-sBTC)</label>
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
                    {(calculatePotentialReward(selectedQuestion, voteChoice) / 1_000_000).toFixed(2)} sBTC
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
                  <TableCell className="max-w-xs truncate">{question.question}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{question.proposedAnswer}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{question.finalAnswer}</Badge>
                  </TableCell>
                  <TableCell>
                    {question.userVote ? (
                      <Badge variant={question.userVote.vote === question.finalAnswer ? 'default' : 'destructive'}>
                        {question.userVote.vote}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No vote</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {question.userVote && !question.userVote.claimed && (
                      <Badge variant="outline" className="text-green-600">Claimable</Badge>
                    )}
                    {question.userVote?.claimed && (
                      <Badge variant="secondary">Claimed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {resolvedDisputes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No resolved disputes yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  highlight?: boolean
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <Card className={highlight ? 'border-green-500/50 bg-green-500/5' : ''}>
      <CardHeader className="space-y-1">
        <CardDescription className="uppercase text-xs tracking-wide">{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
