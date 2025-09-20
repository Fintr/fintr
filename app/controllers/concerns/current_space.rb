# frozen_string_literal: true

module CurrentSpace
  extend ActiveSupport::Concern

  included do
    # No helper_method needed for API controllers
  end

  private

  def current_space
    @current_space ||= find_current_space
  end

  def current_space_user
    @current_space_user ||= find_current_space_user
  end

  def current_space_role
    return nil unless current_user && current_space
    
    @current_space_role ||= begin
      if current_user.has_role?(:admin, current_space)
        "admin"
      elsif current_user.has_role?(:member, current_space)
        "member"
      else
        "member" # default
      end
    end
  end

  def find_current_space
    # Check X-Space-Code header first, then check URL parameters
    space_code = request.headers["X-Space-Code"] || params[:space_id] || params[:id]
    return nil unless space_code

    space = Rails.cache.fetch("current_space_#{space_code}", expires_in: 15.minutes) do
      # Try to find by ID first (UUID), then by code
      Spaces::Space.find_by(id: space_code) || Spaces::Space.find_by(code: space_code)
    end
    
    return space if space && current_user&.spaces&.include?(space)
    nil
  end

  def find_current_space_user
    return nil unless current_space && current_user
    
    Spaces::SpaceUser.find_by(user: current_user, space: current_space)
  end

  def ensure_space_access!
    return if current_space
    
    render_forbidden(message: "No space access. Please provide a valid X-Space-Code header.")
  end

  def ensure_space_admin!
    return if current_user.has_role?(:admin, current_space)
    
    render_forbidden(message: "Admin access required for this action.")
  end

  def ensure_space_member!
    return if current_user.has_role?(:admin, current_space) || current_user.has_role?(:member, current_space)
    
    render_forbidden(message: "You must be a member of this space to perform this action.")
  end
end
