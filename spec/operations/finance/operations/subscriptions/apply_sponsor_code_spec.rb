# frozen_string_literal: true

require "rails_helper"

module Finance
  module Operations
    module Subscriptions
      RSpec.describe ApplySponsorCode, type: :operation do
        subject(:operation) { described_class.new }

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

        describe "#call with unlimited duration promo" do
          let!(:sponsor_code) do
            Finance::SponsorCode.create!(
              code: "UNLIMITED20",
              name: "20% Off Unlimited",
              discount_percentage: 20,
              created_by: admin
            )
          end

          it "calculates discount without duration fields" do
            result = operation.call(
              sponsor_code: "UNLIMITED20",
              subscription_plan_id: subscription_plan.id,
              user_id: user.id.to_s
            )

            expect(result).to be_success
            discount = result.value![:discount]

            expect(discount[:discount_amount_cents]).to eq(10000) # 20% of 50000
            expect(discount[:final_amount_cents]).to eq(40000)
            expect(discount[:discount_months]).to be_nil
            expect(discount[:is_limited_duration]).to be false
            expect(discount[:promo_expires_at]).to be_nil
          end
        end

        describe "#call with limited duration promo" do
          let!(:sponsor_code) do
            Finance::SponsorCode.create!(
              code: "3MONTHS20",
              name: "20% Off for 3 Months",
              discount_percentage: 20,
              discount_months: 3,
              created_by: admin
            )
          end

          it "includes duration fields in discount data" do
            freeze_time do
              result = operation.call(
                sponsor_code: "3MONTHS20",
                subscription_plan_id: subscription_plan.id,
                user_id: user.id.to_s
              )

              expect(result).to be_success
              discount = result.value![:discount]

              expect(discount[:discount_amount_cents]).to eq(10000)
              expect(discount[:final_amount_cents]).to eq(40000)
              expect(discount[:discount_months]).to eq(3)
              expect(discount[:is_limited_duration]).to be true
              expect(discount[:promo_expires_at]).to eq((Time.zone.now + 3.months).iso8601)
            end
          end

          it "calculates correct expiration date from anchor date" do
            anchor_date = Time.zone.parse("2026-01-15 10:00:00")

            Time.use_zone("Asia/Manila") do
              result = operation.call(
                sponsor_code: "3MONTHS20",
                subscription_plan_id: subscription_plan.id,
                user_id: user.id.to_s
              )

              expect(result).to be_success
              discount = result.value![:discount]

              # Expiration should be roughly 3 months from now
              expires_at = Time.zone.parse(discount[:promo_expires_at])
              expect(expires_at).to be_within(1.second).of(Time.zone.now + 3.months)
            end
          end
        end

        describe "#call with amount-based promo with duration" do
          let!(:sponsor_code) do
            Finance::SponsorCode.create!(
              code: "FLAT100",
              name: "₱100 Off for 2 Months",
              discount_amount_cents: 10000,
              discount_months: 2,
              created_by: admin
            )
          end

          it "includes duration fields with amount discount" do
            freeze_time do
              result = operation.call(
                sponsor_code: "FLAT100",
                subscription_plan_id: subscription_plan.id,
                user_id: user.id.to_s
              )

              expect(result).to be_success
              discount = result.value![:discount]

              expect(discount[:discount_amount_cents]).to eq(10000)
              expect(discount[:final_amount_cents]).to eq(40000) # 50000 - 10000
              expect(discount[:discount_months]).to eq(2)
              expect(discount[:discount_percentage]).to be_nil
              expect(discount[:is_limited_duration]).to be true
            end
          end
        end

        describe "validation errors" do
          it "returns failure for non-existent sponsor code" do
            result = operation.call(
              sponsor_code: "INVALID",
              subscription_plan_id: subscription_plan.id,
              user_id: user.id.to_s
            )

            expect(result).to be_failure
            expect(result.failure).to include(sponsor_code: "not found")
          end

          it "returns failure for non-existent subscription plan" do
            sponsor_code = Finance::SponsorCode.create!(
              code: "TEST20",
              name: "Test Promo",
              discount_percentage: 20,
              created_by: admin
            )

            result = operation.call(
              sponsor_code: "TEST20",
              subscription_plan_id: "non-existent-id",
              user_id: user.id.to_s
            )

            expect(result).to be_failure
            expect(result.failure).to include(subscription_plan_id: "not found")
          end

          it "returns failure for inactive sponsor code" do
            sponsor_code = Finance::SponsorCode.create!(
              code: "INACTIVE",
              name: "Inactive Promo",
              discount_percentage: 20,
              active: false,
              created_by: admin
            )

            result = operation.call(
              sponsor_code: "INACTIVE",
              subscription_plan_id: subscription_plan.id,
              user_id: user.id.to_s
            )

            expect(result).to be_failure
            expect(result.failure).to include(sponsor_code: "is not active")
          end

          it "returns failure when user has already used the code" do
            sponsor_code = Finance::SponsorCode.create!(
              code: "ONCEONLY",
              name: "One Time Use",
              discount_percentage: 20,
              created_by: admin
            )

            # First usage
            space = create(:personal_space, owner: user)
            subscription = Finance::SpaceSubscription.create!(
              space: space,
              subscription_plan: subscription_plan,
              subscription_type: "paid",
              status: "active",
              started_at: Time.zone.now,
              xendit_plan_id: "plan_123"
            )

            Finance::UserSponsorCode.create!(
              sponsor_code: sponsor_code,
              user_id: user.id,
              space_subscription: subscription,
              discount_percentage_applied: 20
            )

            # Second usage attempt
            result = operation.call(
              sponsor_code: "ONCEONLY",
              subscription_plan_id: subscription_plan.id,
              user_id: user.id.to_s
            )

            expect(result).to be_failure
            expect(result.failure).to include(sponsor_code: "has already been used by this user")
          end
        end

        describe "timezone handling" do
          let!(:sponsor_code) do
            Finance::SponsorCode.create!(
              code: "TIMEZONE",
              name: "Timezone Test",
              discount_percentage: 20,
              discount_months: 3,
              created_by: admin
            )
          end

          it "handles Asia/Manila timezone" do
            Time.use_zone("Asia/Manila") do
              freeze_time do
                result = operation.call(
                  sponsor_code: "TIMEZONE",
                  subscription_plan_id: subscription_plan.id,
                  user_id: user.id.to_s
                )

                expect(result).to be_success
                expires_at = Time.zone.parse(result.value![:discount][:promo_expires_at])
                expect(expires_at.zone).to eq("PST")
              end
            end
          end

          it "handles UTC timezone" do
            Time.use_zone("UTC") do
              freeze_time do
                result = operation.call(
                  sponsor_code: "TIMEZONE",
                  subscription_plan_id: subscription_plan.id,
                  user_id: user.id.to_s
                )

                expect(result).to be_success
                expires_at = Time.zone.parse(result.value![:discount][:promo_expires_at])
                expect(expires_at.zone).to eq("UTC")
              end
            end
          end
        end
      end
    end
  end
end
