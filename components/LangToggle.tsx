"use client"

import * as React from "react"
import { FlagIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePathname,useRouter } from 'next/navigation'


export function LangToggle() {

    const pathname = usePathname()
    const router = useRouter()


  // Function to switch the language
  const handleLanguageChange = (lang: string) => {
    // Split the pathname into segments
    const pathSegments = pathname.split("/").filter(Boolean);

    // Replace the language part of the path (assume it is the first segment)
    if (pathSegments[0] === "en" || pathSegments[0] === "de") {
      pathSegments[0] = lang;
    } else {
      // If no language prefix exists, add it
      pathSegments.unshift(lang);
    }

    // Join the segments back to form the new path
    const newPath = `/${pathSegments.join("/")}`;

    // Navigate to the new path
    router.push(newPath);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <FlagIcon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleLanguageChange("de")}>
      deutsch
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("en")}>
          english
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
