// Visual order + payment status (REDESIGN T04). Two honest tracks with icons
// and labels (never colour alone). Payments are manual: "Paid" always means
// "confirmed by the seller", never an online charge.
import { Check, CircleDashed, Clock, PackageCheck, Receipt, ShoppingBag, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type StepState = 'done' | 'current' | 'todo' | 'failed';
interface Step {
  label: string;
  hint?: string;
  icon: LucideIcon;
  state: StepState;
}

function Track({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <div className="stepper-track">
      <h3 className="stepper-title">{title}</h3>
      <ol className="stepper">
        {steps.map((s, i) => {
          const Icon = s.state === 'done' ? Check : s.state === 'failed' ? X : s.icon;
          return (
            <li key={i} className={`stepper-step is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
              <span className="stepper-dot">
                <Icon size={16} aria-hidden />
              </span>
              <span className="stepper-text">
                <strong>{s.label}</strong>
                {s.hint && <em>{s.hint}</em>}
              </span>
              <span className="sr-only">
                {s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (current step)' : s.state === 'failed' ? ' (stopped)' : ' (not yet)'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OrderStepper({
  status,
  paymentStatus,
  paymentMethod,
  deliveryMethod,
}: {
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  deliveryMethod?: string | null;
}) {
  const cancelled = status === 'cancelled' || status === 'failed' || status === 'refunded';
  const paid = status === 'paid' || status === 'fulfilled' || paymentStatus === 'paid';
  const fulfilled = status === 'fulfilled';
  const receiptSent = paymentStatus === 'awaiting_confirmation';
  const pickup = deliveryMethod === 'pickup';

  const order: Step[] = [
    { label: 'Order placed', hint: 'The seller has your order', icon: ShoppingBag, state: 'done' },
    {
      label: 'Payment confirmed',
      hint: 'By the seller, when the money lands',
      icon: Wallet,
      state: cancelled ? 'failed' : paid ? 'done' : 'current',
    },
    {
      label: fulfilled ? (pickup ? 'Collected' : 'Delivered') : pickup ? 'Ready for pickup' : 'On its way to you',
      hint: fulfilled ? 'Order complete' : pickup ? 'The seller tells you when to come' : 'The seller arranges delivery',
      icon: PackageCheck,
      state: cancelled ? 'todo' : fulfilled ? 'done' : paid ? 'current' : 'todo',
    },
  ];

  const transfer = paymentMethod === 'bank_transfer' || !paymentMethod;
  const payment: Step[] = cancelled
    ? [{ label: 'Order cancelled', hint: 'No payment is due', icon: X, state: 'failed' }]
    : transfer
      ? [
          { label: 'Awaiting payment', hint: 'Transfer to the seller', icon: Clock, state: paid || receiptSent ? 'done' : 'current' },
          { label: 'Receipt sent', hint: 'Upload your transfer receipt', icon: Receipt, state: paid ? 'done' : receiptSent ? 'current' : 'todo' },
          { label: 'Paid (confirmed by seller)', icon: Check, state: paid ? 'done' : 'todo' },
        ]
      : [
          {
            label: paymentMethod === 'pay_on_pickup' ? 'Pay when you collect' : 'Pay cash on delivery',
            icon: CircleDashed,
            state: paid ? 'done' : 'current',
          },
          { label: 'Paid (confirmed by seller)', icon: Check, state: paid ? 'done' : 'todo' },
        ];

  return (
    <div className="stepper-wrap" aria-label="Order progress">
      <Track title="Order" steps={order} />
      <Track title="Payment" steps={payment} />
    </div>
  );
}
