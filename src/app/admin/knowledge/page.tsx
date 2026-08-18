import { AdminKnowledgeClient } from "./knowledge-client";

export const dynamic = "force-dynamic";

export default function AdminKnowledgePage() {
  return (
    <div>
      <h2 className="chalk-yellow font-chalk text-lg font-bold">知识库同步</h2>
      <p className="mt-1 text-sm text-chalk-400">
        同步国家教育部义务教育阶段的课标与教材数据，作为 Agent 备课的权威依据来源。
      </p>
      <div className="mt-4">
        <AdminKnowledgeClient />
      </div>
    </div>
  );
}
