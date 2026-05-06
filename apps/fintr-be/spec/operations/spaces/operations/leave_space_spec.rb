# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::LeaveSpace, type: :operation do
  let(:owner) { create(:user) }
  let(:member) { create(:user) }
  let(:space) { create(:organization_space, owner: owner) }

  before do
    create(:space_user, user: owner, space: space)
    create(:space_user, user: member, space: space)
    owner.add_role(:admin, space)
    member.add_role(:member, space)
  end

  describe "#call" do
    context "when member leaves the space" do
      let(:valid_params) do
        {
          user_id: member.id.to_s,
          space_id: space.id.to_s,
          space_code: space.code
        }
      end

      it "successfully removes member from the space" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        expect(result.value![:message]).to eq("Successfully left the space")
        expect(member.reload.spaces).not_to include(space)
      end

      it "removes member's roles from the space" do
        described_class.new.call(valid_params)

        expect(member.reload.has_role?(:member, space)).to be false
      end
    end

    context "when member leaves without space_code (optional param)" do
      let(:params_without_code) do
        {
          user_id: member.id.to_s,
          space_id: space.id.to_s
        }
      end

      it "successfully removes member from the space" do
        result = described_class.new.call(params_without_code)

        expect(result).to be_success
        expect(member.reload.spaces).not_to include(space)
      end
    end

    context "when admin (non-owner) leaves the space" do
      let(:admin_user) { create(:user) }
      let(:admin_params) do
        {
          user_id: admin_user.id.to_s,
          space_id: space.id.to_s
        }
      end

      before do
        create(:space_user, user: admin_user, space: space)
        admin_user.add_role(:admin, space)
      end


      it "successfully removes admin from the space" do
        result = described_class.new.call(admin_params)

        expect(result).to be_success
        expect(admin_user.reload.spaces).not_to include(space)
      end

      it "removes admin's roles from the space" do
        described_class.new.call(admin_params)

        expect(admin_user.reload.has_role?(:admin, space)).to be false
      end
    end

    context "when owner tries to leave the space" do
      let(:invalid_params) do
        {
          user_id: owner.id.to_s,
          space_id: space.id.to_s,
          space_code: space.code
        }
      end

      it "returns failure with permission error" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(
          errors: { permission: ["Space owner cannot leave the space. Transfer ownership first or delete the space."] }
        )
        expect(owner.reload.spaces).to include(space)
      end
    end

    context "when user is not a member of the space" do
      let(:non_member) { create(:user) }
      let(:invalid_params) do
        {
          user_id: non_member.id.to_s,
          space_id: space.id.to_s,
          space_code: space.code
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { user: ["User does not belong to this space"] })
      end
    end

    context "with invalid user_id" do
      let(:invalid_params) do
        {
          user_id: "invalid-uuid",
          space_id: space.id.to_s,
          space_code: space.code
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { user: ["not found"] })
      end
    end

    context "with invalid space_id" do
      let(:invalid_params) do
        {
          user_id: member.id.to_s,
          space_id: "invalid-uuid",
          space_code: space.code
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { space: ["not found"] })
      end
    end

    context "when space has no owner" do
      let(:space_without_owner) { create(:organization_space, owner: nil) }
      let(:params) do
        {
          user_id: admin_user.id.to_s,
          space_id: space_without_owner.id.to_s,
          space_code: space_without_owner.code
        }
      end
      let(:admin_user) { create(:user) }

      before do
        create(:space_user, user: admin_user, space: space_without_owner)
        admin_user.add_role(:admin, space_without_owner)
      end


      it "allows admin to leave since no owner is set" do
        result = described_class.new.call(params)

        expect(result).to be_success
        expect(admin_user.reload.spaces).not_to include(space_without_owner)
      end
    end
  end
end
