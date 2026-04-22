# frozen_string_literal: true

require "rails_helper"

module Finance
  RSpec.describe SponsorCode, type: :model do
    let(:user) { create(:user) }

    describe "validations" do
      it "is valid with valid attributes" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          created_by: user
        )
        expect(sponsor_code).to be_valid
      end

      it "is valid with discount_months" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 3,
          created_by: user
        )
        expect(sponsor_code).to be_valid
      end

      it "is invalid with discount_months less than 1" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 0,
          created_by: user
        )
        expect(sponsor_code).not_to be_valid
        expect(sponsor_code.errors[:discount_months]).to include("must be greater than 0")
      end

      it "is valid without discount_months (unlimited duration)" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: nil,
          created_by: user
        )
        expect(sponsor_code).to be_valid
      end
    end

    describe "#limited_duration?" do
      it "returns true when discount_months is present" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 3,
          created_by: user
        )
        expect(sponsor_code.limited_duration?).to be true
      end

      it "returns false when discount_months is nil" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: nil,
          created_by: user
        )
        expect(sponsor_code.limited_duration?).to be false
      end

      it "returns false when discount_months is 0" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 0,
          created_by: user
        )
        expect(sponsor_code.limited_duration?).to be false
      end
    end

    describe "#promo_expiration_date" do
      let(:anchor_date) { Time.zone.parse("2026-01-15 10:00:00") }

      it "returns expiration date based on discount_months" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 3,
          created_by: user
        )

        expiration = sponsor_code.promo_expiration_date(anchor_date)
        expect(expiration).to eq(anchor_date + 3.months)
      end

      it "returns nil when discount_months is nil" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: nil,
          created_by: user
        )

        expect(sponsor_code.promo_expiration_date(anchor_date)).to be_nil
      end

      it "uses current time as default" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 1,
          created_by: user
        )

        freeze_time do
          expiration = sponsor_code.promo_expiration_date
          expect(expiration).to eq(Time.zone.now + 1.month)
        end
      end

      it "handles year boundary correctly" do
        sponsor_code = SponsorCode.new(
          code: "TEST20",
          name: "Test Promo",
          discount_percentage: 20,
          discount_months: 3,
          created_by: user
        )

        dec_date = Time.zone.parse("2026-12-15 10:00:00")
        expiration = sponsor_code.promo_expiration_date(dec_date)
        expect(expiration).to eq(Time.zone.parse("2027-03-15 10:00:00"))
      end
    end

    describe "scopes" do
      before do
        @unlimited = SponsorCode.create!(
          code: "UNLIMITED",
          name: "Unlimited Promo",
          discount_percentage: 20,
          created_by: user
        )
        @limited_3m = SponsorCode.create!(
          code: "3MONTHS",
          name: "3 Month Promo",
          discount_percentage: 20,
          discount_months: 3,
          created_by: user
        )
        @limited_6m = SponsorCode.create!(
          code: "6MONTHS",
          name: "6 Month Promo",
          discount_percentage: 15,
          discount_months: 6,
          created_by: user
        )
      end

      describe ".with_duration" do
        it "returns only promo codes with discount_months set" do
          results = SponsorCode.with_duration
          expect(results).to include(@limited_3m, @limited_6m)
          expect(results).not_to include(@unlimited)
        end
      end
    end
  end
end
