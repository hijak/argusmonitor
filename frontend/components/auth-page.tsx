import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { Auth } from "@/components/auth";

export function AuthPage() {
	return (
		<div className="relative grid h-screen grid-cols-1 overflow-hidden md:grid-cols-2 lg:grid-cols-3">
			<div className="flex size-full items-center px-8 md:border-r lg:col-span-2">
				<Auth />
			</div>
			<div className="relative hidden size-full md:flex">
				<div
					aria-hidden={true}
					className="absolute inset-0 blur-md dark:bg-[radial-gradient(50%_80%_at_50%_-10%,--theme(--color-foreground/0.08),transparent)]"
				/>
				<FlickeringGrid
					className="mask-x-from-75% mask-b-to-96% absolute inset-0 z-0"
					color="#666666"
					flickerChance={0.5}
					gridGap={6}
					maxOpacity={0.6}
					squareSize={2}
				/>
				<div className="z-10 mt-auto w-full pb-8">
					<h2 className="text-center text-base text-muted-foreground">
						Trusted by teams at
					</h2>
					<div className="relative flex items-center justify-center gap-4 py-4 lg:gap-8">
						{logos.map((logo) => (
							<img
								alt={logo.alt}
								className="pointer-events-none h-4 w-fit select-none dark:brightness-0 dark:invert"
								height="auto"
								key={logo.alt}
								loading="lazy"
								src={logo.src}
								width="auto"
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

const logos = [
	{
		src: "https://storage.efferd.com/logo/turso-wordmark.svg",
		alt: "Turso Logo",
	},
	{
		src: "https://storage.efferd.com/logo/openai-wordmark.svg",
		alt: "OpenAI Logo",
	},
	{
		src: "https://storage.efferd.com/logo/dub-wordmark.svg",
		alt: "Dub Logo",
	},
	{
		src: "https://storage.efferd.com/logo/stripe-wordmark.svg",
		alt: "Stripe Logo",
	},
];
