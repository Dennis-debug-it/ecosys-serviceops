import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ErrorPanelProps {
  title?: string;
  message: string;
}

export function ErrorPanel({ title = "We hit a snag", message }: ErrorPanelProps) {
  return (
    <Card className="rounded-[24px] border-rose-200 bg-rose-50/80 p-5 text-rose-900">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-full bg-rose-500/10 p-2 text-rose-600">
          <TriangleAlert className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-rose-800">{message}</p>
        </div>
      </div>
    </Card>
  );
}
