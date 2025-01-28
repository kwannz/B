import { ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

interface ToastActionElement {
  altText: string;
  action: () => void;
  label: string;
}

export type { ToastProps, ToastActionElement }
