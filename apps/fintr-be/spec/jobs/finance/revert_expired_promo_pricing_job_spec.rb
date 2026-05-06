# frozen_string_literal: true

require "rails_helper"

module Finance
  RSpec.describe RevertExpiredPromoPricingJob, type: :job do
    describe "#perform" do
      let(:user) { create(:user) }
      let(:admin) { create(:user) }

      let!(:subscription_plan) do
        create(
          :subscription_plan,
          slug: "premium-#{SecureRandom.hex(4)}",
          interval: "month",
          token_limit: 1000,
          price_cents: 50000
        )
      end

      let!(:sponsor_code) do
        SponsorCode.create!(
          code: "3MONTHS20",
          name: "20% Off for 3 Months",
          discount_percentage: 20,
          discount_months: 3,
          created_by: admin
        )
      end

      # Create a subscription with expired promo
      let!(:expired_subscription) do
        space = create(:personal_space, owner: user)
        sub = SpaceSubscription.create!(
          space: space,
          subscription_plan: subscription_plan,
          sponsor_code: sponsor_code,
          subscription_type: "paid",
          status: "active",
          started_at: 4.months.ago,
          xendit_plan_id: "plan_expired_123",
          xendit_reference_id: "ref_expired_123",
          xendit_customer_id: "cust_expired_123",
          metadata: {
            "promo_expires_at" => 1.month.ago.iso8601,
            "original_subscription_amount_cents" => 50000,
            "discount_applied" => {
              "original_amount_cents" => 50000,
              "discount_amount_cents" => 10000,
              "final_amount_cents" => 40000,
              "discount_months" => 3
            }
          }
        )
        sub
      end

      # Create a subscription with active promo (not expired)
      let!(:active_promo_subscription) do
        space = create(:personal_space, owner: create(:user))
        sub = SpaceSubscription.create!(
          space: space,
          subscription_plan: subscription_plan,
          sponsor_code: sponsor_code,
          subscription_type: "paid",
          status: "active",
          started_at: 1.month.ago,
          xendit_plan_id: "plan_active_123",
          xendit_reference_id: "ref_active_123",
          xendit_customer_id: "cust_active_123",
          metadata: {
            "promo_expires_at" => 2.months.from_now.iso8601,
            "original_subscription_amount_cents" => 50000,
            "discount_applied" => {
              "original_amount_cents" => 50000,
              "discount_amount_cents" => 10000,
              "final_amount_cents" => 40000,
              "discount_months" => 3
            }
          }
        )
        sub
      end

      # Create a subscription with no promo
      let!(:no_promo_subscription) do
        space = create(:personal_space, owner: create(:user))
        sub = SpaceSubscription.create!(
          space: space,
          subscription_plan: subscription_plan,
          subscription_type: "paid",
          status: "active",
          started_at: 1.month.ago,
          xendit_plan_id: "plan_no_promo_123",
          metadata: {}
        )
        sub
      end

      # Create a subscription that was already reverted
      let!(:already_reverted_subscription) do
        space = create(:personal_space, owner: create(:user))
        sub = SpaceSubscription.create!(
          space: space,
          subscription_plan: subscription_plan,
          sponsor_code: sponsor_code,
          subscription_type: "paid",
          status: "active",
          started_at: 5.months.ago,
          xendit_plan_id: "plan_reverted_123",
          metadata: {
            "promo_expires_at" => 2.months.ago.iso8601,
            "promo_reverted" => true,
            "promo_reverted_at" => 1.month.ago.iso8601,
            "original_subscription_amount_cents" => 50000
          }
        )
        sub
      end

      context "with expired promo subscriptions" do
        before do
          # Mock Xendit client
          allow_any_instance_of(Integrations::Payments::Xendit::Client)
            .to receive(:update_subscription_plan)
            .and_return({ id: "updated_plan", status: "ACTIVE" })
        end

        it "reverts expired promo subscriptions" do
          expect do
            described_class.perform_now
          end.to change { expired_subscription.reload.metadata["promo_reverted"] }
            .from(nil).to(true)
        end

        it "updates Xendit subscription to original amount" do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)
          allow(client).to receive(:update_subscription_plan)
            .and_return({ id: "updated", status: "ACTIVE" })

          described_class.perform_now

          expect(client).to have_received(:update_subscription_plan).with(
            plan_id: "plan_expired_123",
            params: hash_including(
              amount: 500.0, # 50000 cents = 500.0
              metadata: hash_including(
                promo_reverted: true,
                original_amount_cents: 50000
              )
            )
          )
        end

        it "records the reversion timestamp" do
          freeze_time do
            described_class.perform_now

            expired_subscription.reload
            expect(expired_subscription.metadata["promo_reverted_at"]).to eq(Time.current.iso8601)
          end
        end

        it "records the job ID in metadata" do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)
          allow(client).to receive(:update_subscription_plan)
            .and_return({ id: "updated", status: "ACTIVE" })

          described_class.perform_now

          expired_subscription.reload
          expect(expired_subscription.metadata["promo_reverted_job_id"]).to be_present
        end
      end

      context "with active (non-expired) promo subscriptions" do
        it "does not revert active promo subscriptions" do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)

          # Should not update the active promo subscription
          allow(client).to receive(:update_subscription_plan)
            .with(plan_id: "plan_active_123", params: anything)
            .and_return({ id: "updated", status: "ACTIVE" })

          # But should update the expired one
          expect(client).to receive(:update_subscription_plan)
            .with(plan_id: "plan_expired_123", params: anything)
            .at_least(:once)
            .and_return({ id: "updated", status: "ACTIVE" })

          described_class.perform_now

          active_promo_subscription.reload
          expect(active_promo_subscription.metadata["promo_reverted"]).to be_nil
        end
      end

      context "with already reverted subscriptions" do
        it "does not process already reverted subscriptions" do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)

          # Should not update the already reverted subscription
          allow(client).to receive(:update_subscription_plan)
            .with(plan_id: "plan_reverted_123", params: anything)
            .and_return({ id: "updated", status: "ACTIVE" })

          # But should update the expired one
          expect(client).to receive(:update_subscription_plan)
            .with(plan_id: "plan_expired_123", params: anything)
            .at_least(:once)
            .and_return({ id: "updated", status: "ACTIVE" })

          described_class.perform_now
        end
      end

      context "with no promo subscriptions" do
        it "does not process subscriptions without promo" do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)

          # Should not update subscription without promo
          allow(client).to receive(:update_subscription_plan)
            .with(plan_id: "plan_no_promo_123", params: anything)
            .and_return({ id: "updated", status: "ACTIVE" })

          # But should update the expired one
          expect(client).to receive(:update_subscription_plan)
            .with(plan_id: "plan_expired_123", params: anything)
            .at_least(:once)
            .and_return({ id: "updated", status: "ACTIVE" })

          described_class.perform_now
        end
      end

      context "when Xendit API fails" do
        before do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)
          allow(client).to receive(:update_subscription_plan)
            .and_raise(Integrations::Payments::Xendit::Error.new(message: "API Error", status: 500, code: "ERROR"))
        end

        it "marks subscription as failed" do
          described_class.perform_now

          expired_subscription.reload
          expect(expired_subscription.metadata["promo_revert_failed"]).to be(true)
          expect(expired_subscription.metadata["promo_revert_error"]).to eq("API Error")
        end

        it "logs the error" do
          expect(Rails.logger).to receive(:error)
            .with(/\[RevertPromoPricing\] Xendit error for subscription #{expired_subscription.id}/)

          described_class.perform_now
        end
      end

      context "with missing original amount" do
        let!(:no_original_amount_subscription) do
          space = create(:personal_space, owner: create(:user))
          sub = SpaceSubscription.create!(
            space: space,
            subscription_plan: subscription_plan,
            sponsor_code: sponsor_code,
            subscription_type: "paid",
            status: "active",
            started_at: 4.months.ago,
            xendit_plan_id: "plan_no_amount_123",
            metadata: {
              "promo_expires_at" => 1.month.ago.iso8601,
              # Missing original_subscription_amount_cents
              "discount_applied" => {}
            }
          )
          sub
        end

        it "logs warning and skips subscription" do
          expect(Rails.logger).to receive(:warn)
            .with(/\[RevertPromoPricing\] No original_amount_cents found for subscription #{no_original_amount_subscription.id}/)

          described_class.perform_now

          no_original_amount_subscription.reload
          expect(no_original_amount_subscription.metadata["promo_reverted"]).to be_nil
        end
      end

      context "with multiple expired subscriptions" do
        let!(:second_expired_subscription) do
          space = create(:personal_space, owner: create(:user))
          sub = SpaceSubscription.create!(
            space: space,
            subscription_plan: subscription_plan,
            sponsor_code: sponsor_code,
            subscription_type: "paid",
            status: "active",
            started_at: 5.months.ago,
            xendit_plan_id: "plan_expired_2_123",
            xendit_reference_id: "ref_expired_2_123",
            xendit_customer_id: "cust_expired_2_123",
            metadata: {
              "promo_expires_at" => 2.months.ago.iso8601,
              "original_subscription_amount_cents" => 50000,
              "discount_applied" => {
                "original_amount_cents" => 50000,
                "discount_amount_cents" => 10000,
                "final_amount_cents" => 40000,
                "discount_months" => 3
              }
            }
          )
          sub
        end

        it "processes all expired subscriptions" do
          client = instance_double(Integrations::Payments::Xendit::Client)
          allow(Integrations::Payments::Xendit::Client).to receive(:new).and_return(client)
          allow(client).to receive(:update_subscription_plan)
            .and_return({ id: "updated", status: "ACTIVE" })

          described_class.perform_now

          # Both expired subscriptions should be reverted
          expired_subscription.reload
          second_expired_subscription.reload

          expect(expired_subscription.metadata["promo_reverted"]).to be(true)
          expect(second_expired_subscription.metadata["promo_reverted"]).to be(true)
        end
      end
    end
  end
end
