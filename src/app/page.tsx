import { Card, PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="머니로그" />
      <Card className="p-6">
        <p className="text-[16px] font-semibold">새로 만드는 중이에요</p>
        <p className="mt-1 text-[14px] text-ink-3">테마·디자인·아이콘만 남겨 두었어요.</p>
      </Card>
    </>
  );
}
