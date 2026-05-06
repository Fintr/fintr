# frozen_string_literal: true

module Spaces
  class PersonalSpace < Space
    resourcify :custom_association_name, :role_cname => "Auth::Role", :role_table_name => "roles"
  end
end
