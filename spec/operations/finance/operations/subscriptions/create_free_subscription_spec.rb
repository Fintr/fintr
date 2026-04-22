# frozen_string_literal: true

require "rails_helper"

module Finance
  module Operations
    module Subscriptions
      RSpec.describe CreateFreeSubscription, type: :operation do
        subject(:operation) { described_class.new }

        let(:user) { create(:user) }
        let(:admin) { create(:user) }
        let(:space) { create(:personal_space, owner: user) }
        let!(:subscription_plan) { create(:subscription_plan, slug: "monthly-#{SecureRandom.hex(4)}", interval: "month", token_limit: 1000) }
        let!(:yearly_plan) { create(:subscription_plan, slug: "yearly-#{SecureRandom.hex(4)}", interval: "year", token_limit: 12000) }

        describe "#call" do
          context "with basic parameters" do
            let(:params) do
              {
                space_id: space.id,
                subscription_plan_id: subscription_plan.id,
                granted_by: admin.id.to_s,
                notes: "Free subscription for vlogger"
              }
            end

            it "creates a free subscription successfully" do
              result = operation.call(params)

              expect(result).to be_success
              subscription = result.value!
              expect(subscription).to be_a(Finance::SpaceSubscription)
              expect(subscription.subscription_type).to eq("free")
              expect(subscription.status).to eq("active")
            end

            it "creates the first billing cycle" do
              result = operation.call(params)
              subscription = result.value!

              expect(subscription.billing_cycles.count).to eq(1)
              cycle = subscription.billing_cycles.first
              expect(cycle.cycle_number).to eq(1.0)
              expect(cycle.status).to eq("paid")
            end
          end

          context "with timezone handling" do
            around do |example|
              Time.use_zone("Asia/Manila") do
                example.run
              end
            end

            it "uses current time in the correct timezone" do
              freeze_time do
                current_time = Time.zone.now
                result = operation.call(params)
                subscription = result.value!

                expect(subscription.started_at).to be_within(1.second).of(current_time)
                expect(subscription.metadata["granted_at"]).to eq(current_time.iso8601)
              end
            end

            it "creates billing cycle with correct span in the timezone" do
              result = operation.call(params)
              subscription = result.value!
              cycle = subscription.billing_cycles.first

              start_time = cycle.started_at.in_time_zone("Asia/Manila")
              end_time = cycle.ends_at.in_time_zone("Asia/Manila")

              expect(start_time.zone).to eq("PST")
              expect(end_time.zone).to eq("PST")
              # Span should be approximately 1 month (30 days +/- 1 day variation)
              expect((end_time - start_time).abs).to be_within(2.days).of(30.days)
            end

            it "sets paid_at to current time in the timezone" do
              freeze_time do
                current_time = Time.zone.now
                result = operation.call(params)
                subscription = result.value!
                cycle = subscription.billing_cycles.first

                expect(cycle.paid_at).to eq(current_time)
                expect(cycle.paid_at.zone).to eq("PST")
              end
            end

            context "with yearly plan" do
              let(:params) do
                {
                  space_id: space.id,
                  subscription_plan_id: yearly_plan.id,
                  granted_by: admin.id.to_s,
                  notes: "Yearly free subscription"
                }
              end

              it "creates yearly cycle span" do
                result = operation.call(params)
                subscription = result.value!
                cycle = subscription.billing_cycles.first

                start_time = cycle.started_at
                end_time = cycle.ends_at

                # Span should be approximately 1 year (365 days +/- 1 day for leap years)
                expect((end_time - start_time).abs).to be_within(2.days).of(365.days)
              end
            end

            context "with custom anchor date" do
              let(:custom_date) { Time.zone.parse("2026-01-15 10:00:00") }
              let(:params) do
                {
                  space_id: space.id,
                  subscription_plan_id: subscription_plan.id,
                  granted_by: admin.id.to_s,
                  anchor_date: custom_date
                }
              end

              it "uses the custom anchor date" do
                result = operation.call(params)
                subscription = result.value!

                expect(subscription.started_at).to eq(custom_date)
              end

              it "calculates cycle end from anchor date" do
                result = operation.call(params)
                subscription = result.value!
                cycle = subscription.billing_cycles.first

                expect(cycle.started_at).to eq(custom_date)
                expect(cycle.ends_at).to be_within(1.second).of(custom_date + 1.month)
              end

              it "stores anchor date in the correct timezone format" do
                result = operation.call(params)
                subscription = result.value!

                # The date should be stored in UTC internally but represent the correct time
                expect(subscription.started_at.utc.iso8601).to include("2026-01-15")
              end
            end
          end

          context "with different timezones" do
            it "handles UTC timezone" do
              Time.use_zone("UTC") do
                result = operation.call(params)
                expect(result).to be_success

                subscription = result.value!
                expect(subscription.started_at.zone).to eq("UTC")
              end
            end

            it "handles America/New_York timezone" do
              Time.use_zone("America/New_York") do
                result = operation.call(params)
                expect(result).to be_success

                subscription = result.value!
                # Zone can be EST or EDT depending on DST
                expect(%w[EST EDT]).to include(subscription.started_at.zone)
              end
            end

            it "handles Asia/Tokyo timezone" do
              Time.use_zone("Asia/Tokyo") do
                result = operation.call(params)
                expect(result).to be_success

                subscription = result.value!
                expect(subscription.started_at.zone).to eq("JST")
              end
            end
          end

          context "with date boundaries" do
            it "handles month-end dates correctly" do
              # January 31 + 1 month should be February 28/29 (not March)
              jan_31 = Time.zone.parse("2026-01-31 12:00:00")
              params_with_jan_31 = params.merge(anchor_date: jan_31)

              result = operation.call(params_with_jan_31)
              subscription = result.value!
              cycle = subscription.billing_cycles.first

              # Cycle should end at the end of February
              expect(cycle.ends_at.month).to eq(2)
            end

            it "handles leap year dates correctly" do
              # February 29, 2024 is a leap year
              feb_29 = Time.zone.parse("2024-02-29 12:00:00")
              params_with_feb_29 = params.merge(anchor_date: feb_29)

              result = operation.call(params_with_feb_29)
              subscription = result.value!
              cycle = subscription.billing_cycles.first

              # +1 month from Feb 29 should be March 29
              expect(cycle.ends_at.month).to eq(3)
              expect(cycle.ends_at.day).to eq(29)
            end

            it "handles year boundary correctly" do
              dec_31 = Time.zone.parse("2025-12-31 12:00:00")
              params_with_dec_31 = params.merge(anchor_date: dec_31)

              result = operation.call(params_with_dec_31)
              subscription = result.value!
              cycle = subscription.billing_cycles.first

              # +1 month from Dec 31 should be Jan 31 of next year
              expect(cycle.ends_at.year).to eq(2026)
              expect(cycle.ends_at.month).to eq(1)
              expect(cycle.ends_at.day).to eq(31)
            end
          end
        end

        describe "Contract validation" do
          context "with invalid parameters" do
            it "fails when space_id is missing" do
              result = operation.call(
                subscription_plan_id: subscription_plan.id,
                granted_by: admin.id.to_s
              )

              expect(result).to be_failure
              expect(result.failure).to include(:space_id)
            end

            it "fails when subscription_plan_id is missing" do
              result = operation.call(
                space_id: space.id,
                granted_by: admin.id.to_s
              )

              expect(result).to be_failure
              expect(result.failure).to include(:subscription_plan_id)
            end

            it "fails when granted_by is missing" do
              result = operation.call(
                space_id: space.id,
                subscription_plan_id: subscription_plan.id
              )

              expect(result).to be_failure
              expect(result.failure).to include(:granted_by)
            end
          end
        end

        describe "metadata storage" do
          it "stores all metadata fields correctly" do
            result = operation.call(params)
            subscription = result.value!

            metadata = subscription.metadata
            expect(metadata["granted_by"]).to eq(admin.id.to_s)
            expect(metadata["notes"]).to eq("Free subscription for vlogger")
            expect(metadata["is_free_subscription"]).to eq(true)
            expect(metadata["space_name"]).to eq(space.name)
            expect(metadata["space_type"]).to eq(space.type)
          end

          it "stores granted_at in ISO8601 format" do
            freeze_time do
              result = operation.call(params)
              subscription = result.value!

              expect(subscription.metadata["granted_at"]).to match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
            end
          end
        end

        describe "Xendit fields" do
          it "leaves all Xendit fields nil" do
            result = operation.call(params)
            subscription = result.value!

            expect(subscription.xendit_plan_id).to be_nil
            expect(subscription.xendit_reference_id).to be_nil
            expect(subscription.xendit_customer_id).to be_nil
            expect(subscription.xendit_schedule_id).to be_nil
          end

          it "leaves xendit_cycle_id nil in billing cycle" do
            result = operation.call(params)
            subscription = result.value!
            cycle = subscription.billing_cycles.first

            expect(cycle.xendit_cycle_id).to be_nil
          end
        end

        describe "error handling" do
          context "when space already has active subscription" do
            before do
              # Create an existing active subscription
              Finance::SpaceSubscription.create!(
                space: space,
                subscription_plan: subscription_plan,
                subscription_type: "paid",
                status: "active",
                started_at: Time.zone.now,
                xendit_plan_id: "existing_plan"
              )
            end

            it "returns failure" do
              result = operation.call(params)

              expect(result).to be_failure
              expect(result.failure).to include(:subscription)
            end
          end

          context "when space has pending subscription" do
            before do
              Finance::SpaceSubscription.create!(
                space: space,
                subscription_plan: subscription_plan,
                subscription_type: "paid",
                status: "pending",
                started_at: Time.zone.now,
                xendit_plan_id: "pending_plan"
              )
            end

            it "returns failure" do
              result = operation.call(params)

              expect(result).to be_failure
            end
          end

          context "when space has requires_action subscription" do
            before do
              Finance::SpaceSubscription.create!(
                space: space,
                subscription_plan: subscription_plan,
                subscription_type: "paid",
                status: "requires_action",
                started_at: Time.zone.now,
                xendit_plan_id: "requires_action_plan"
              )
            end

            it "returns failure" do
              result = operation.call(params)

              expect(result).to be_failure
            end
          end

          context "when space not found" do
            it "returns failure with space_id error" do
              result = operation.call(
                space_id: "non-existent-id",
                subscription_plan_id: subscription_plan.id,
                granted_by: admin.id.to_s
              )

              expect(result).to be_failure
              expect(result.failure).to include(space_id: "not found")
            end
          end

          context "when subscription plan not found" do
            it "returns failure with subscription_plan_id error" do
              result = operation.call(
                space_id: space.id,
                subscription_plan_id: "non-existent-id",
                granted_by: admin.id.to_s
              )

              expect(result).to be_failure
              expect(result.failure).to include(subscription_plan_id: "not found")
            end
          end
        end

        def params
          {
            space_id: space.id,
            subscription_plan_id: subscription_plan.id,
            granted_by: admin.id.to_s,
            notes: "Free subscription for vlogger"
          }
        end
      end
    end
  end
end
