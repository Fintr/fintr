# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::GrantAccess, type: :operation do
  let(:admin_user) { create(:user) }
  let(:target_user) { create(:user, email: "target@example.com") }
  let(:space) { create(:organization_space) }
  
  let(:valid_params) do
    {
      user_id: admin_user.id.to_s,
      space_id: space.id.to_s,
      space_code: space.code,
      email: target_user.email,
      role: "member"
    }
  end

  describe "#call" do
    context "with valid parameters" do
      it "successfully grants access to user" do
        result = described_class.new.call(valid_params)
        
        expect(result).to be_success
        expect(result.value![:user]).to eq(target_user)
        expect(result.value![:access_link]).to be_present
        
        # Check that a SpaceUser invitation was created
        space_user = Spaces::SpaceUser.find_by(space: space, user: target_user, invitation_status: 'pending')
        expect(space_user).to be_present
        expect(space_user.access_code).to be_present
      end
    end

    context "with admin role" do
      let(:admin_params) { valid_params.merge(role: "admin") }

      it "assigns admin role to user" do
        result = described_class.new.call(admin_params)
        
        expect(result).to be_success
        
        # Check if role was created in database
        role = Auth::Role.find_by(name: 'admin', resource_type: space.class.name, resource_id: space.id)
        expect(role).to be_present
        
        # Check if user_role relationship exists
        user_role = ActiveRecord::Base.connection.execute(
          "SELECT * FROM users_roles WHERE user_id = '#{target_user.id}' AND role_id = '#{role.id}'"
        ).first
        expect(user_role).to be_present
        
        # Check using direct database query instead of rolify
        user_roles = ActiveRecord::Base.connection.execute(
          "SELECT r.name FROM roles r 
           INNER JOIN users_roles ur ON r.id = ur.role_id 
           WHERE ur.user_id = '#{target_user.id}' 
           AND r.resource_type = '#{space.class.name}' 
           AND r.resource_id = '#{space.id}'"
        )
        expect(user_roles.first&.[]('name')).to eq('admin')
      end
    end

    context "with non-existent user email" do
      let(:invalid_params) { valid_params.merge(email: "nonexistent@example.com") }

      it "returns failure" do
        result = described_class.new.call(invalid_params)
        
        expect(result).to be_failure
        expect(result.failure).to include(errors: { email: ["User not found. User must have an account first."] })
      end
    end

    context "when user already belongs to space" do
      before do
        create(:space_user, user: target_user, space: space)
      end

      it "returns failure" do
        result = described_class.new.call(valid_params)
        
        expect(result).to be_failure
        expect(result.failure).to include(errors: { user: ["already belongs to this space"] })
      end
    end

    context "with invalid parameters" do
      let(:invalid_params) { valid_params.merge(email: nil) }

      it "returns failure" do
        result = described_class.new.call(invalid_params)
        
        expect(result).to be_failure
      end
    end
  end
end
