import { AdminTeachersClient } from "./teachers-client";

export const dynamic = "force-dynamic";

export default function AdminTeachersPage() {
  return (
    <div>
      <h2 className="chalk-yellow font-chalk text-lg font-bold">教师身份认证</h2>
      <p className="mt-1 text-sm text-chalk-400">
        教师注册时自选学段、任教学科与年级，提交后进入待审核状态；审核通过后获得认证标识。
      </p>
      <div className="mt-4">
        <AdminTeachersClient />
      </div>
    </div>
  );
}
