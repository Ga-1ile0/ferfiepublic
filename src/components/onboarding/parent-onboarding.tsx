"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/authContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { TokenType } from "@prisma/client"
import { createChildWithWallet } from "@/server/kids"
import { getFamilyPrivateKey, updateFamilyCurrency } from "@/server/family"
import { updateUserName } from "@/server/user"
import { DownloadPrivateKeyDialog } from "@/components/dialogs/download-private-key-dialog"
import {
    User,
    DollarSign,
    Users,
    Baby,
    CheckCircle,
    ArrowRight,
    ArrowLeft,
    Plus,
    X,
    Wallet,
    Key,
    Sparkles,
    Heart,
} from "lucide-react"

type OnboardingStep = "welcome" | "profile" | "currency" | "family" | "children" | "complete"

interface ChildInfo {
    name: string
    walletType: "new" | "import"
    privateKey?: string
    id?: string
}

const STEPS = [
    { id: "welcome", title: "Welcome", icon: Sparkles },
    { id: "profile", title: "Profile", icon: User },
    { id: "currency", title: "Currency", icon: DollarSign },
    { id: "family", title: "Family", icon: Users },
    { id: "children", title: "Children", icon: Baby },
    { id: "complete", title: "Complete", icon: CheckCircle },
]

const CURRENCIES = [
    { value: "USDC", label: "USDC", symbol: "$", logo: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694" },
    { value: "EURC", label: "EURC", symbol: "€", logo: "https://assets.coingecko.com/coins/images/26045/standard/euro.png?1696525125" },
    { value: "CADC", label: "CADC", symbol: "$", logo: "https://assets.coingecko.com/coins/images/14149/standard/cadc_2.png?1696513868" },
    { value: "BRZ", label: "BRZ", symbol: "R$", logo: "https://assets.coingecko.com/coins/images/8472/standard/MicrosoftTeams-image_%286%29.png" },
    { value: "IDRX", label: "IDRX", symbol: "Rp", logo: "https://assets.coingecko.com/coins/images/34883/standard/IDRX_BLUE_COIN_200x200.png?1734983273" },
]

export function ParentOnboarding() {
    const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome")
    const [parentName, setParentName] = useState("")
    const [familyName, setFamilyName] = useState("")
    const [selectedCurrency, setSelectedCurrency] = useState<TokenType>("USDC")
    const [childName, setChildName] = useState("")
    const [walletType, setWalletType] = useState<"new" | "import">("new")
    const [privateKey, setPrivateKey] = useState("")
    const [children, setChildren] = useState<ChildInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showKeyDownloadDialog, setShowKeyDownloadDialog] = useState(false)
    const [walletsForDownload, setWalletsForDownload] = useState<
        Array<{
            id: string
            name: string
            privateKey: string
            type: "child" | "family"
        }>
    >([])

    const { user, completeOnboarding } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user?.name && !user?.needsOnboarding) {
            router.push("/")
        }
    }, [user, router])

    const getCurrentStepIndex = () => STEPS.findIndex((step) => step.id === currentStep)
    const getProgress = () => ((getCurrentStepIndex() + 1) / STEPS.length) * 100

    const handleNextStep = () => {
        const steps: OnboardingStep[] = ["welcome", "profile", "currency", "family", "children", "complete"]
        const currentIndex = steps.indexOf(currentStep)
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1])
        }
    }

    const handlePreviousStep = () => {
        const steps: OnboardingStep[] = ["welcome", "profile", "currency", "family", "children", "complete"]
        const currentIndex = steps.indexOf(currentStep)
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1])
        }
    }

    const handleAddChild = () => {
        if (!childName) {
            toast({
                title: "Error",
                description: "Please enter a name for your child",
                variant: "destructive",
            })
            return
        }

        if (walletType === "import" && !privateKey) {
            toast({
                title: "Error",
                description: "Please enter a private key",
                variant: "destructive",
            })
            return
        }

        const newChild: ChildInfo = {
            name: childName,
            walletType,
            ...(walletType === "import" && { privateKey }),
        }

        setChildren([...children, newChild])
        setChildName("")
        setPrivateKey("")
        setWalletType("new")
    }

    const handleRemoveChild = (index: number) => {
        const updatedChildren = [...children]
        updatedChildren.splice(index, 1)
        setChildren(updatedChildren)
    }

    const handleCompleteOnboarding = async () => {
        if (!user?.id) {
            toast({
                title: "Error",
                description: "User not authenticated",
                variant: "destructive",
            })
            router.push("/")
            return
        }

        setIsLoading(true)

        try {
            const nameResult = await updateUserName(user.id, parentName)
            if (nameResult.status !== 200) {
                throw new Error(nameResult.message || "Failed to update user name")
            }

            if (user.familyId) {
                let currencyAddress = ""
                switch (selectedCurrency) {
                    case "USDC":
                        currencyAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
                        break
                    case "EURC":
                        currencyAddress = "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42"
                        break
                    case "CADC":
                        currencyAddress = "0x043eb4b75d0805c43d7c834902e335621983cf03"
                        break
                    case "BRZ":
                        currencyAddress = "0xE9185Ee218cae427aF7B9764A011bb89FeA761B4"
                        break
                    case "IDRX":
                        currencyAddress = "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22"
                        break
                    default:
                        throw new Error("Unsupported currency selected")
                }

                const currencyResult = await updateFamilyCurrency(user.familyId, selectedCurrency, currencyAddress)
                if (currencyResult.status !== 200) {
                    throw new Error(currencyResult.message || "Failed to update family currency")
                }
            }

            setWalletsForDownload([])
            const family = await getFamilyPrivateKey(user.id)

            if (family.status === 200 && family.data?.privateKey) {
                const familyWallet = {
                    id: "family",
                    name: "Family Wallet",
                    privateKey: family.data.privateKey,
                    type: "family" as const,
                }

                setWalletsForDownload((prevWallets) => [...prevWallets, familyWallet])
            }

            let hasWalletsToDownload = user.privateKey ? true : false
            for (const child of children) {
                if (!user.walletAddress) continue

                const childResult = await createChildWithWallet(
                    child.name,
                    user.walletAddress,
                    child.walletType === "import" ? { privateKey: child.privateKey || "" } : undefined,
                )

                if (
                    childResult.status === 200 &&
                    childResult.data &&
                    "privateKey" in childResult.data &&
                    childResult.data.privateKey
                ) {
                    hasWalletsToDownload = true
                    setWalletsForDownload((prevWallets) => [
                        ...prevWallets,
                        {
                            id: "id" in childResult.data ? childResult.data.id : "child",
                            name: "name" in childResult.data ? childResult.data.name || child.name : child.name,
                            privateKey: childResult.data.privateKey || "",
                            type: "child" as const,
                        },
                    ])
                } else {
                    toast({
                        title: "Warning",
                        description: `Failed to create child ${child.name}: ${childResult.message || "Unknown error"}`,
                        variant: "destructive",
                    })
                }
            }

            if (hasWalletsToDownload) {
                setShowKeyDownloadDialog(true)
                return
            }

            toast({
                title: "Success",
                description: "Onboarding completed successfully!",
            })

            window.location.href = "/"
        } catch (error) {
            console.error("Onboarding error:", error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "An unexpected error occurred",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDownloadComplete = () => {
        setShowKeyDownloadDialog(false)
        setWalletsForDownload([])
        completeOnboarding()

        toast({
            title: "Success",
            description: "Onboarding completed! Redirecting you to the home page...",
        })

        // Add a delay to ensure the download has time to start before redirecting
        // This is especially important for Safari on iOS
        setTimeout(() => {
            // Use window.location.replace to prevent the back button from coming back to onboarding
            window.location.replace("/")
        }, 1500) // 1.5 seconds should be enough time for the download to start
    }

    const currentStepData = STEPS.find((step) => step.id === currentStep)
    const StepIcon = currentStepData?.icon || Sparkles

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                {/* Progress Bar in Header */}
                <div className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="animate-bounce">
                                <StepIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                                Step {getCurrentStepIndex() + 1} of {STEPS.length}
                            </span>
                        </div>
                        <span className="text-sm text-gray-500">{Math.round(getProgress())}%</span>
                    </div>
                    <Progress value={getProgress()} className="h-2 transition-all duration-500 ease-out" />
                </div>

                {currentStep === "welcome" && (
                    <div className="animate-in fade-in-50 slide-in-from-right-5 duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <span>Welcome to ferfie!</span>
                                <div className="animate-pulse">🎉</div>
                            </CardTitle>
                            <CardDescription>Let's set up your family account to get started.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p>This quick onboarding process will help you:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li className="animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-100">
                                    Set up your profile
                                </li>
                                <li className="animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-200">
                                    Choose your preferred currency
                                </li>
                                <li className="animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-300">
                                    Create your family
                                </li>
                                <li className="animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-400">Add your children</li>
                            </ul>
                            <div className="text-center text-sm text-gray-500 animate-pulse">This will only take a 30 seconds ⏱️</div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button onClick={handleNextStep} className="group">
                                Get Started
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardFooter>
                    </div>
                )}

                {currentStep === "profile" && (
                    <div className="animate-in fade-in-50 slide-in-from-right-5 duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                {/* <User className="w-5 h-5 animate-pulse text-blue-600" /> */}
                                <span>Your Profile</span>
                            </CardTitle>
                            <CardDescription>Lets set your profile up.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="parentName">Your Name</Label>
                                <Input
                                    id="parentName"
                                    placeholder="Enter your name"
                                    value={parentName}
                                    onChange={(e) => setParentName(e.target.value)}
                                    className="transition-all duration-200 focus:scale-[1.02]"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button onClick={handlePreviousStep} className="group">
                                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                Back
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleNextStep}
                                disabled={!parentName}
                                className="group"
                            >
                                Next
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardFooter>
                    </div>
                )}

                {currentStep === "currency" && (
                    <div className="animate-in fade-in-50 slide-in-from-right-5 duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                {/* <DollarSign className="w-5 h-5 animate-pulse text-blue-600" /> */}
                                <span>Select Currency</span>
                            </CardTitle>
                            <CardDescription>Choose the default currency for your family.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <RadioGroup value={selectedCurrency} onValueChange={(value) => setSelectedCurrency(value as TokenType)}>
                                {CURRENCIES.map((currency, index) => (
                                    <div
                                        key={currency.value}
                                        className={`animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-${index * 100}`}
                                    >
                                        <div className="flex items-center space-x-2 group">
                                            <RadioGroupItem value={currency.value} id={currency.value.toLowerCase()} />
                                            <Label
                                                htmlFor={currency.value.toLowerCase()}
                                                className="flex items-center space-x-2 cursor-pointer group-hover:text-blue-600 transition-colors"
                                            >
                                                <img src={currency.logo} alt={currency.label} className="w-6 h-6 object-contain" />
                                                <span>
                                                    {currency.label} ({currency.symbol})
                                                </span>
                                            </Label>
                                        </div>
                                    </div>
                                ))}
                            </RadioGroup>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button onClick={handlePreviousStep} className="group">
                                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                Back
                            </Button>
                            <Button variant="outline" onClick={handleNextStep} className="group">
                                Next
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardFooter>
                    </div>
                )}

                {currentStep === "family" && (
                    <div className="animate-in fade-in-50 slide-in-from-right-5 duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                {/* <Users className="w-5 h-5 animate-pulse text-purple-600" /> */}
                                <span>Create Your Family</span>
                            </CardTitle>
                            <CardDescription>Give your family a name.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="familyName">Family Name</Label>
                                <Input
                                    id="familyName"
                                    placeholder="Enter family name"
                                    value={familyName}
                                    onChange={(e) => setFamilyName(e.target.value)}
                                    className="transition-all duration-200 focus:scale-[1.02]"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button onClick={handlePreviousStep} className="group">
                                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                Back
                            </Button>
                            <Button variant="outline" onClick={handleNextStep} disabled={!familyName} className="group">
                                Next
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardFooter>
                    </div>
                )}

                {currentStep === "children" && (
                    <div className="animate-in fade-in-50 slide-in-from-right-5 duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                {/* <Baby className="w-5 h-5 animate-bounce text-orange-600" /> */}
                                <span>Add Children</span>
                            </CardTitle>
                            <CardDescription>Add your children to your family account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="childName">Child's Name</Label>
                                <Input
                                    id="childName"
                                    placeholder="Enter child's name"
                                    value={childName}
                                    onChange={(e) => setChildName(e.target.value)}
                                    className="transition-all duration-200 focus:scale-[1.02]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Wallet Setup</Label>
                                <RadioGroup value={walletType} onValueChange={setWalletType as any}>
                                    <div className="flex items-center space-x-2 group">
                                        <RadioGroupItem value="new" id="new" />
                                        <Label
                                            htmlFor="new"
                                            className="flex items-center space-x-2 cursor-pointer group-hover:text-blue-600 transition-colors"
                                        >
                                            <Wallet className="w-4 h-4" />
                                            <span>Generate new wallet</span>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2 group">
                                        <RadioGroupItem value="import" id="import" />
                                        <Label
                                            htmlFor="import"
                                            className="flex items-center space-x-2 cursor-pointer group-hover:text-orange-600 transition-colors"
                                        >
                                            <Key className="w-4 h-4" />
                                            <span>Import existing wallet</span>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {walletType === "import" && (
                                <div className="space-y-2 animate-in fade-in-50 slide-in-from-top-5 duration-300">
                                    <Label htmlFor="privateKey">Private Key</Label>
                                    <Input
                                        id="privateKey"
                                        placeholder="Enter private key"
                                        value={privateKey}
                                        onChange={(e) => setPrivateKey(e.target.value)}
                                        type="password"
                                        className="transition-all duration-200 focus:scale-[1.02]"
                                    />
                                </div>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full group hover:bg-blue-50 transition-colors"
                                onClick={handleAddChild}
                                disabled={!childName}
                            >
                                <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                                Add Child
                            </Button>

                            {children.length > 0 && (
                                <div className="mt-4 animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
                                    <h3 className="text-sm font-medium mb-2 flex items-center space-x-2">
                                        <span>Children:</span>
                                        <Badge variant="secondary" className="animate-pulse text-[#b74b28]">
                                            {children.length}
                                        </Badge>
                                    </h3>
                                    <ul className="space-y-2">
                                        {children.map((child, index) => (
                                            <li
                                                key={index}
                                                className="flex justify-between items-center p-2 bg-secondary rounded-md animate-in fade-in-50 slide-in-from-left-5 duration-300 hover:bg-secondary/80 transition-colors group"
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <Baby className="w-4 h-4 text-orange-600" />
                                                    <span>{child.name}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveChild(index)}
                                                    className="text-muted-foreground hover:text-red-600 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button onClick={handlePreviousStep} className="group">
                                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                Back
                            </Button>
                            <Button variant="outline" onClick={handleNextStep} className="group">
                                Next
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardFooter>
                    </div>
                )}

                {currentStep === "complete" && (
                    <div className="animate-in fade-in-50 slide-in-from-right-5 duration-500">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <CheckCircle className="w-5 h-5 animate-pulse text-green-600" />
                                <span>Complete Setup</span>
                            </CardTitle>
                            <CardDescription>Review your information and complete the setup.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-100">
                                    <span className="text-sm font-medium">Your Name:</span>
                                    <Badge variant="secondary">{parentName}</Badge>
                                </div>
                                <div className="flex justify-between items-center animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-200">
                                    <span className="text-sm font-medium">Family Name:</span>
                                    <Badge variant="secondary">{familyName}</Badge>
                                </div>
                                <div className="flex justify-between items-center animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-300">
                                    <span className="text-sm font-medium">Default Currency:</span>
                                    <Badge variant="secondary" className="flex items-center space-x-1">
                                        <img src={CURRENCIES.find((c) => c.value === selectedCurrency)?.logo} alt={selectedCurrency} className="w-5 h-5 object-contain" />
                                        <span>{selectedCurrency}</span>
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-start animate-in fade-in-50 slide-in-from-left-5 duration-300 delay-400">
                                    <span className="text-sm font-medium">Children:</span>
                                    <div className="text-right">
                                        {children.length > 0 ? (
                                            <div className="space-y-1">
                                                {children.map((child, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="outline"
                                                        className="block animate-pulse text-[#b74b28]"
                                                        style={{ animationDelay: `${index * 200}ms` }}
                                                    >
                                                        {child.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <Badge variant="outline">No children added</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 animate-in fade-in-50 slide-in-from-bottom-5 duration-500 delay-500">
                                <div className="flex items-center space-x-2">
                                    <Heart className="w-4 h-4 text-red-500 animate-pulse" />
                                    <span className="text-sm text-blue-800">
                                        Almost there! We'll create secure wallets for your family.
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button onClick={handlePreviousStep} className="group">
                                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                Back
                            </Button>
                            <Button variant="outline" onClick={handleCompleteOnboarding} disabled={isLoading} className="group">
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Setting Up...
                                    </>
                                ) : (
                                    <>
                                        Complete Setup
                                        <CheckCircle className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </div>
                )}
            </Card>

            {walletsForDownload.length > 0 && (
                <DownloadPrivateKeyDialog
                    open={showKeyDownloadDialog}
                    onOpenChange={setShowKeyDownloadDialog}
                    wallets={walletsForDownload}
                    onDownloadComplete={() => handleKeyDownloadComplete()}
                />
            )}
        </div>
    )
}
