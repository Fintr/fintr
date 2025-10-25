# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::JoinSpace, type: :operation do
  let(:user) { create(:user) }
  let(:space) { create(:organization_space) }
  let(:invited_by) { create(:user) }
  let!(:space_user_invitation) { create(:space_user, space: space, user: nil, invitation_status: 'pending', access_code: 'VALID123', invited_by: invited_by) }

  let(:valid_params) do
    {
      user_id: user.id.to_s,
      access_code: 'VALID123'
    }
  end

  describe "#call" do
    context "with valid parameters" do
      it "successfully joins user to space" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        expect(result.value!.id).to eq(space.id)
        expect(user.reload.spaces).to include(space)
        expect(user.has_role?(:member, space)).to be true
      end
    end

    context "with invalid access code" do
      let(:invalid_params) { valid_params.merge(access_code: "INVALID") }

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { access: ["not found or expired"] })
      end
    end

    context "with expired access" do
      let!(:expired_invitation) { create(:space_user, space: space, user: nil, invitation_status: 'pending', access_code: 'EXPIRED123', invited_by: invited_by, invitation_expires_at: 1.day.ago) }
      let(:expired_params) { valid_params.merge(access_code: 'EXPIRED123') }

      it "returns failure" do
        result = described_class.new.call(expired_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { access: ["has expired"] })
      end
    end

    context "when user already belongs to space" do
      before do
        create(:space_user, user: user, space: space)
      end

      it "returns failure" do
        result = described_class.new.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { user: ["already belongs to this space"] })
      end
    end

    context "with invalid user_id" do
      let(:invalid_params) { valid_params.merge(user_id: "invalid") }

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
      end
    end
  end
end
