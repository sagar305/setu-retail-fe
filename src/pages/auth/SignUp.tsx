import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Field } from "../../components/ui";
import { ApiError, authApi, type SignupInput } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import { AuthLayout } from "./AuthLayout";

const CODE_TO_FIELD: Record<string, keyof SignupInput> = {
  email_taken: "email",
  username_taken: "username",
  phone_used: "phone",
  invalid_phone: "phone",
  tax_number_used: "taxNumber",
  invalid_tax_number: "taxNumber",
};

export function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupInput>({ businessName: "", ownerName: "", email: "", username: "", password: "", phone: "", taxNumber: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof SignupInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      const res = await authApi.signup({ ...form, taxNumber: form.taxNumber || undefined });
      navigate(`/check-email?email=${encodeURIComponent(res.email)}`);
    } catch (err) {
      if (err instanceof ApiError && CODE_TO_FIELD[err.code]) setErrors({ [CODE_TO_FIELD[err.code]!]: err.message });
      else if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else setGeneral(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your shop" subtitle="3 months free on Basic. No card needed.">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {general ? <Alert tone="error">{general}</Alert> : null}
        <Field label="Business name" name="businessName" required value={form.businessName} onChange={set("businessName")} error={errors.businessName} />
        <Field label="Your name" name="ownerName" autoComplete="name" required value={form.ownerName} onChange={set("ownerName")} error={errors.ownerName} />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} error={errors.email} />
        <Field label="Username" name="username" autoComplete="username" required value={form.username} onChange={set("username")} error={errors.username} hint="You can sign in with this or your email." />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters." />
        <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set("phone")} error={errors.phone} />
        <Field label="GSTIN or tax number (optional)" name="taxNumber" value={form.taxNumber} onChange={set("taxNumber")} error={errors.taxNumber} hint="Printed on your bills. You can add it later." />
        <Button type="submit" busy={busy} className="h-[50px] text-base">
          Create account
        </Button>
      </form>
      <p className="m-0 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/sign-in" className="font-semibold text-indigo">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
