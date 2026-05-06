# frozen_string_literal: true

module Auth
  Token = Struct.new(:token) do
    def validate_permissions(permissions)
      required_permissions = Set.new permissions
      scopes = token[0]["scope"]
      token_permissions = scopes.present? ? Set.new(scopes.split(" ")) : Set.new
      required_permissions <= token_permissions
    end
  end
end
