"use client"

import { createContext, useContext, useState, type ReactNode, useEffect } from "react"
import { router } from "expo-router"
import { useAuth } from "./AuthContext"
import SocketService from "../services/SocketService"

interface Player {
    id: string
    username: string
    avatar: string
    score: number
    level: number
    country: string
}

interface Question {
    id: string
    text: string
    image?: string
    options: {
        id: string
        text: string
        isCorrect?: boolean
    }[]
    category: string
    timeLimit: number
}

interface GameRoom {
    id: string
    code: string
    host: string
    players: Player[]
    gameMode: string
    status: "waiting" | "playing" | "finished"
    currentRound: number
    totalRounds: number
    timePerQuestion: number
}

interface GameContextType {
    room: GameRoom | null
    currentQuestion: Question | null
    players: Player[]
    isHost: boolean
    isPlaying: boolean
    timeLeft: number
    userAnswered: boolean
    connectionStatus: "connected" | "disconnected" | "connecting"
    createRoom: (gameMode: string, rounds: number, timePerQuestion: number) => void
    joinRoom: (code: string) => void
    leaveRoom: () => void
    startGame: () => void
    submitAnswer: (questionId: string, optionId: string) => void
    resetGame: () => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const useGame = () => {
    const context = useContext(GameContext)
    if (!context) {
        throw new Error("useGame must be used within a GameProvider")
    }
    return context
}

interface GameProviderProps {
    children: ReactNode
}

export const GameProvider = ({ children }: GameProviderProps) => {
    const { user } = useAuth()

    const [room, setRoom] = useState<GameRoom | null>(null)
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [isPlaying, setIsPlaying] = useState(false)
    const [timeLeft, setTimeLeft] = useState(0)
    const [userAnswered, setUserAnswered] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected")

    const isHost = room?.host === user?.id

    useEffect(() => {
        if (!user) return

        // Connecter le socket quand l'utilisateur est authentifié
        const connectSocket = async () => {
            setConnectionStatus("connecting")
            const success = await SocketService.connect(user.id)
            setConnectionStatus(success ? "connected" : "disconnected")
        }
        
        connectSocket()

        // Écouter les événements de connexion
        const unsubscribeConnectionStatus = SocketService.on("connection:status", (status) => {
            setConnectionStatus(status.connected ? "connected" : "disconnected")
            
            // Si reconnecté et dans une partie, tenter de rejoindre à nouveau
            if (status.connected && room) {
                SocketService.emit("room:rejoin", { roomId: room.id, userId: user.id })
            }
        })

        // Room events
        const unsubscribeRoomCreated = SocketService.on("room:created", (newRoom: GameRoom) => {
            setRoom(newRoom)
            setPlayers(newRoom.players)
            router.push("/game/lobby")
        })

        const unsubscribeRoomJoined = SocketService.on("room:joined", (newRoom: GameRoom) => {
            setRoom(newRoom)
            setPlayers(newRoom.players)
            router.push("/game/lobby")
        })

        const unsubscribeRoomUpdated = SocketService.on("room:updated", (updatedRoom: GameRoom) => {
            setRoom(updatedRoom)
            setPlayers(updatedRoom.players)
        })

        const unsubscribePlayerJoined = SocketService.on("player:joined", (updatedPlayers: Player[]) => {
            setPlayers(updatedPlayers)
        })

        const unsubscribePlayerLeft = SocketService.on("player:left", (updatedPlayers: Player[]) => {
            setPlayers(updatedPlayers)
        })

        // Game events
        const unsubscribeGameStarted = SocketService.on("game:started", () => {
            setIsPlaying(true)
            router.push("/game/play")
        })

        const unsubscribeGameQuestion = SocketService.on("game:question", (question: Question, time: number) => {
            setCurrentQuestion(question)
            setTimeLeft(time)
            setUserAnswered(false)
        })

        const unsubscribeGameTime = SocketService.on("game:time", (time: number) => {
            setTimeLeft(time)
        })

        const unsubscribeGameAnswerResult = SocketService.on("game:answer_result", (isCorrect: boolean) => {
            // Handle answer result
        })

        const unsubscribeGameEnded = SocketService.on("game:ended", (results: Player[]) => {
            setIsPlaying(false)
            setPlayers(results)
            setCurrentQuestion(null)
            router.push("/game/results")
        })

        const unsubscribeRoomClosed = SocketService.on("room:closed", () => {
            resetGame()
            router.push("/(tabs)")
        })

        // Cleanup
        return () => {
            unsubscribeConnectionStatus()
            unsubscribeRoomCreated()
            unsubscribeRoomJoined()
            unsubscribeRoomUpdated()
            unsubscribePlayerJoined()
            unsubscribePlayerLeft()
            unsubscribeGameStarted()
            unsubscribeGameQuestion()
            unsubscribeGameTime()
            unsubscribeGameAnswerResult()
            unsubscribeGameEnded()
            unsubscribeRoomClosed()
        }
    }, [user, room])

    const createRoom = (gameMode: string, rounds: number, timePerQuestion: number) => {
        if (!user) return

        SocketService.emit("room:create", {
            gameMode,
            rounds,
            timePerQuestion,
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                country: user.country,
            },
        })
    }

    const joinRoom = (code: string) => {
        if (!user) return

        SocketService.emit("room:join", {
            code,
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                country: user.country,
            },
        })
    }

    const leaveRoom = () => {
        if (!room) return

        SocketService.emit("room:leave", { roomId: room.id })
        resetGame()
    }

    const startGame = () => {
        if (!room || !isHost) return

        SocketService.emit("game:start", { roomId: room.id })
    }

    const submitAnswer = (questionId: string, optionId: string) => {
        if (!room || !currentQuestion) return

        setUserAnswered(true)
        SocketService.emit("game:answer", {
            roomId: room.id,
            questionId,
            optionId,
        })
    }

    const resetGame = () => {
        setRoom(null)
        setCurrentQuestion(null)
        setPlayers([])
        setIsPlaying(false)
        setTimeLeft(0)
        setUserAnswered(false)
    }

    return (
        <GameContext.Provider
            value={{
                room,
                currentQuestion,
                players,
                isHost,
                isPlaying,
                timeLeft,
                userAnswered,
                connectionStatus,
                createRoom,
                joinRoom,
                leaveRoom,
                startGame,
                submitAnswer,
                resetGame,
            }}
        >
            {children}
        </GameContext.Provider>
    )
}

export default GameContext
