# frozen_string_literal: true

require "rails_helper"

RSpec.describe Finance::Operations::Webhooks::HandleWebhook, type: :operation do
  let(:operation) { described_class.new }
  let(:space_subscription) do
    create(
      :space_subscription,
      space: space,
      subscription_plan: subscription_plan,
      xendit_plan_id: "plan-test-123",
      status: "pending"
    )
  end
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "basic", token_limit: 50, price_cents: 14_900) }
  let(:webhook_token) { "test_webhook_token" }

  before do
    create(:space_user, space: space, user: user)
    allow(ENV).to receive(:[]).with("XENDIT_WEBHOOK_TOKEN").and_return(webhook_token)
  end

  describe "#validate" do
    context "with valid parameters" do
      it "returns success" do
        params = {
          payload: { event: "test.event" },
          webhook_token: webhook_token
        }

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with missing payload" do
      it "returns failure" do
        params = { webhook_token: webhook_token }

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:payload)
      end
    end

    context "with invalid webhook_token" do
      it "returns failure when token does not match" do
        params = {
          payload: { event: "test.event" },
          webhook_token: "invalid_token"
        }

        result = operation.validate(params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:webhook_token)
        expect(result.failure[:webhook_token]).to include("webhook token unauthorized")
      end
    end

    context "with valid webhook_token" do
      it "returns success when token matches" do
        params = {
          payload: { event: "test.event" },
          webhook_token: webhook_token
        }

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end

    context "with nil webhook_token" do
      it "returns success" do
        params = {
          payload: { event: "test.event" },
          webhook_token: nil
        }

        result = operation.validate(params: params)

        expect(result).to be_success
      end
    end
  end

  describe "#call" do
    context "with recurring.plan.activation event" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.activation",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "ACTIVE"
            }
          },
          webhook_token: webhook_token
        }
      end

      it "activates the subscription" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
        expect(space_subscription.started_at).to be_present
      end
    end

    context "with recurring.plan.activated event" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.activated",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "ACTIVE"
            }
          },
          webhook_token: webhook_token
        }
      end

      it "activates the subscription" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "with recurring.plan.inactivation event" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.inactivation",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "INACTIVE"
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        space_subscription.update!(status: "active")
      end

      it "inactivates the subscription" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
        expect(space_subscription.ended_at).to be_present
      end
    end

    context "with recurring.plan.inactivated event" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.inactivated",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "INACTIVE"
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        space_subscription.update!(status: "active")
      end

      it "inactivates the subscription" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
      end
    end

    context "with recurring.cycle.created event" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.cycle.created",
            data: {
              plan_id: space_subscription.xendit_plan_id,
              id: "cycle-123",
              cycle_number: 1,
              reference_id: "ref-123",
              scheduled_timestamp: Time.current.iso8601
            }
          },
          webhook_token: webhook_token
        }
      end

      it "creates a billing cycle" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        billing_cycle = Finance::BillingCycle.find_by(xendit_cycle_id: "cycle-123")
        expect(billing_cycle).to be_present
        expect(billing_cycle.cycle_number).to eq(1)
      end
    end

    context "with recurring.cycle.retrying event" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.cycle.retrying",
            data: {
              plan_id: space_subscription.xendit_plan_id,
              id: "cycle-123",
              cycle_number: 1,
              reference_id: "ref-123"
            }
          },
          webhook_token: webhook_token
        }
      end

      it "handles cycle retrying" do
        result = operation.call(webhook_data)

        expect(result).to be_success
      end
    end

    context "with recurring.cycle.succeeded event" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: "cycle-123",
          cycle_number: 1
        )
      end
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.cycle.succeeded",
            data: {
              plan_id: space_subscription.xendit_plan_id,
              id: "cycle-123",
              cycle_number: 1,
              reference_id: "ref-123",
              scheduled_timestamp: Time.current.iso8601,
              status: "SUCCEEDED",
              amount: 14_900,
              currency: "PHP"
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        billing_cycle
      end

      it "creates a payment record" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        payment = Finance::Payment.find_by(xendit_cycle_id: "cycle-123")
        expect(payment).to be_present
        expect(payment.status).to eq("succeeded")
        expect(payment.amount_cents).to eq(14_900)
        expect(payment.paid_at).to be_present
      end
    end

    context "with recurring.cycle.failed event" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: "cycle-123",
          cycle_number: 1
        )
      end
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.cycle.failed",
            data: {
              plan_id: space_subscription.xendit_plan_id,
              id: "cycle-123",
              cycle_number: 1,
              reference_id: "ref-123",
              failure_reason: "Insufficient funds",
              actions: [
                {
                  url: "https://example.com/retry"
                }
              ]
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        billing_cycle
      end

      it "creates a failed payment record" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        payment = Finance::Payment.find_by(xendit_cycle_id: "cycle-123")
        expect(payment).to be_present
        expect(payment.status).to eq("failed")
        expect(payment.failed_at).to be_present
        expect(payment.failure_reason).to eq("Insufficient funds")
      end
    end

    context "with payment.session.succeeded event" do
      let(:payment_session_handler) do
        instance_double(Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded)
      end
      let(:webhook_data) do
        {
          payload: {
            event: "payment.session.succeeded",
            data: {
              id: "session-123",
              status: "SUCCEEDED"
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        allow(Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded).to receive(:new)
          .and_return(payment_session_handler)
        allow(payment_session_handler).to receive(:call)
          .and_return(Dry::Monads::Success({ message: "Payment session succeeded" }))
      end

      it "routes to HandlePaymentSessionSucceeded" do
        expect(payment_session_handler).to receive(:call)

        result = operation.call(webhook_data)

        expect(result).to be_success
      end
    end

    context "with payment.session.completed event" do
      let(:payment_session_handler) do
        instance_double(Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded)
      end
      let(:webhook_data) do
        {
          payload: {
            event: "payment.session.completed",
            data: {
              id: "session-123",
              status: "COMPLETED"
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        allow(Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded).to receive(:new)
          .and_return(payment_session_handler)
        allow(payment_session_handler).to receive(:call)
          .and_return(Dry::Monads::Success({ message: "Payment session completed" }))
      end

      it "routes to HandlePaymentSessionSucceeded" do
        expect(payment_session_handler).to receive(:call)

        result = operation.call(webhook_data)

        expect(result).to be_success
      end
    end

    context "with payment_session.succeeded event" do
      let(:payment_session_handler) do
        instance_double(Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded)
      end
      let(:webhook_data) do
        {
          payload: {
            event: "payment_session.succeeded",
            data: {
              id: "session-123",
              status: "SUCCEEDED"
            }
          },
          webhook_token: webhook_token
        }
      end

      before do
        allow(Finance::Operations::PaymentSessions::Webhooks::HandlePaymentSessionSucceeded).to receive(:new)
          .and_return(payment_session_handler)
        allow(payment_session_handler).to receive(:call)
          .and_return(Dry::Monads::Success({ message: "Payment session succeeded" }))
      end

      it "routes to HandlePaymentSessionSucceeded" do
        expect(payment_session_handler).to receive(:call)

        result = operation.call(webhook_data)

        expect(result).to be_success
      end
    end

    context "with event extracted from type field" do
      let(:webhook_data) do
        {
          payload: {
            type: "recurring.plan.activation",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "ACTIVE"
            }
          },
          webhook_token: webhook_token
        }
      end

      it "extracts event from type field" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "with event extracted from event_type field" do
      let(:webhook_data) do
        {
          payload: {
            event_type: "recurring.plan.activation",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "ACTIVE"
            }
          },
          webhook_token: webhook_token
        }
      end

      it "extracts event from event_type field" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "with event inferred from payload structure - plan activation" do
      let(:webhook_data) do
        {
          payload: {
            id: space_subscription.xendit_plan_id,
            status: "ACTIVE"
          },
          webhook_token: webhook_token
        }
      end

      it "infers recurring.plan.activation from status ACTIVE" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "with event inferred from payload structure - plan inactivation" do
      let(:webhook_data) do
        {
          payload: {
            id: space_subscription.xendit_plan_id,
            status: "INACTIVE"
          },
          webhook_token: webhook_token
        }
      end

      before do
        space_subscription.update!(status: "active")
      end

      it "infers recurring.plan.inactivation from status INACTIVE" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("inactive")
      end
    end

    context "with event inferred from payload structure - cycle succeeded" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: "cycle-123",
          cycle_number: 1
        )
      end
      let(:webhook_data) do
        {
          payload: {
            cycle: {
              id: "cycle-123"
            },
            status: "SUCCEEDED",
            plan_id: space_subscription.xendit_plan_id,
            id: "cycle-123",
            cycle_number: 1,
            reference_id: "ref-123",
            scheduled_timestamp: Time.current.iso8601
          },
          webhook_token: webhook_token
        }
      end

      before do
        billing_cycle
      end

      it "infers recurring.cycle.succeeded from cycle and status" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        payment = Finance::Payment.find_by(xendit_cycle_id: "cycle-123")
        expect(payment).to be_present
        expect(payment.status).to eq("succeeded")
      end
    end

    context "with event inferred from payload structure - cycle failed" do
      let(:billing_cycle) do
        create(
          :finance_billing_cycle,
          space_subscription: space_subscription,
          xendit_cycle_id: "cycle-123",
          cycle_number: 1
        )
      end
      let(:webhook_data) do
        {
          payload: {
            cycle: {
              id: "cycle-123"
            },
            status: "FAILED",
            plan_id: space_subscription.xendit_plan_id,
            id: "cycle-123",
            cycle_number: 1,
            reference_id: "ref-123",
            failure_reason: "Insufficient funds",
            actions: [
              {
                url: "https://example.com/retry"
              }
            ]
          },
          webhook_token: webhook_token
        }
      end

      before do
        billing_cycle
      end

      it "infers recurring.cycle.failed from cycle and status" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        payment = Finance::Payment.find_by(xendit_cycle_id: "cycle-123")
        expect(payment).to be_present
        expect(payment.status).to eq("failed")
      end
    end

    context "with event inferred from payload structure - cycle retrying" do
      let(:webhook_data) do
        {
          payload: {
            cycle: {
              id: "cycle-123"
            },
            status: "RETRYING",
            plan_id: space_subscription.xendit_plan_id,
            id: "cycle-123",
            cycle_number: 1,
            reference_id: "ref-123"
          },
          webhook_token: webhook_token
        }
      end

      it "infers recurring.cycle.retrying from cycle and status" do
        result = operation.call(webhook_data)

        expect(result).to be_success
      end
    end

    context "with event inferred from payload structure - cycle created" do
      let(:webhook_data) do
        {
          payload: {
            cycle: {
              id: "cycle-123"
            },
            plan_id: space_subscription.xendit_plan_id,
            id: "cycle-123",
            cycle_number: 1,
            reference_id: "ref-123",
            scheduled_timestamp: Time.current.iso8601
          },
          webhook_token: webhook_token
        }
      end

      it "infers recurring.cycle.created from cycle id" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        billing_cycle = Finance::BillingCycle.find_by(xendit_cycle_id: "cycle-123")
        expect(billing_cycle).to be_present
      end
    end

    context "with data extracted from explicit data key" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.activation",
            data: {
              id: space_subscription.xendit_plan_id,
              status: "ACTIVE",
              custom_field: "custom_value"
            }
          },
          webhook_token: webhook_token
        }
      end

      it "uses explicit data key" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "with data extracted from payload when no data key" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.activation",
            id: space_subscription.xendit_plan_id,
            status: "ACTIVE",
            custom_field: "custom_value"
          },
          webhook_token: webhook_token
        }
      end

      it "uses entire payload minus event keys as data" do
        result = operation.call(webhook_data)

        expect(result).to be_success
        space_subscription.reload
        expect(space_subscription.status).to eq("active")
      end
    end

    context "with invalid webhook token" do
      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.activation",
            data: {
              id: space_subscription.xendit_plan_id
            }
          },
          webhook_token: "invalid_token"
        }
      end

      it "returns failure" do
        result = operation.call(webhook_data)

        expect(result).to be_failure
        expect(result.failure).to have_key(:webhook_token)
      end
    end

    context "when webhook token is not configured" do
      before do
        allow(ENV).to receive(:[]).with("XENDIT_WEBHOOK_TOKEN").and_return(nil)
      end

      let(:webhook_data) do
        {
          payload: {
            event: "recurring.plan.activation",
            data: {
              id: space_subscription.xendit_plan_id
            }
          },
          webhook_token: nil
        }
      end

      it "processes webhook without token validation" do
        result = operation.call(webhook_data)

        expect(result).to be_success
      end
    end

    context "with unknown event" do
      let(:webhook_data) do
        {
          payload: {
            event: "unknown.event",
            data: {}
          },
          webhook_token: webhook_token
        }
      end

      it "returns failure" do
        result = operation.call(webhook_data)

        expect(result).to be_failure
        expect(result.failure).to have_key(:event)
        expect(result.failure[:event]).to include("Unknown webhook event")
      end
    end

    context "with missing event" do
      let(:webhook_data) do
        {
          payload: {
            data: {}
          },
          webhook_token: webhook_token
        }
      end

      it "returns failure" do
        result = operation.call(webhook_data)

        expect(result).to be_failure
        expect(result.failure).to have_key(:event)
        expect(result.failure[:event]).to eq("missing")
      end
    end
  end
end
