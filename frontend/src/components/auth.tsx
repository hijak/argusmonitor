"use client";

import { cn } from "@/lib/utils";
import type React from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { AuthDivider } from "@/components/auth-divider";
import { AtSignIcon } from "lucide-react";

export function Auth() {
	return (
		<div
			className={cn(
				"mx-auto flex flex-col items-center justify-center gap-6 sm:w-sm",
				"fade-in slide-in-from-bottom-4 animate-in duration-600"
			)}
		>
			<a className="block w-max rounded-md p-2 hover:bg-muted" href="#">
				<Logo className="h-5" />
			</a>
			<div className="flex flex-col space-y-1 text-center">
				<h1 className="font-semibold text-2xl">Sign In or Join Now!</h1>
				<p className="text-muted-foreground text-sm">
					Sign in or create your Efferd account to get started.
				</p>
			</div>
			<Button className="w-full" size="lg" variant="outline">
				<GoogleIcon data-icon="inline-start" />
				Continue with Google
			</Button>

			<AuthDivider>OR CONTINUE WITH EMAIL</AuthDivider>

			<form className="w-full space-y-2">
				<InputGroup>
					<InputGroupInput
						placeholder="Enter your email address"
						type="email"
					/>
					<InputGroupAddon align="inline-start">
						<AtSignIcon
						/>
					</InputGroupAddon>
				</InputGroup>

				<Button className="w-full" type="button">
					Continue With Email
				</Button>
			</form>
			<p className="text-muted-foreground text-xs">
				By continuing, you agree to Efferd’s{" "}
				<a className="underline underline-offset-4 hover:text-primary" href="#">
					Terms
				</a>{" "}
				and{" "}
				<a className="underline underline-offset-4 hover:text-primary" href="#">
					Privacy Policy
				</a>
				.
			</p>
		</div>
	);
}

const GoogleIcon = (props: React.ComponentProps<"svg">) => (
	<svg
		fill="currentColor"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<g>
			<path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669   C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62   c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401   c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
		</g>
	</svg>
);
