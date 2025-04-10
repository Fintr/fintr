# frozen_string_literal: true

module Auth
  Response = Struct.new(:decoded_token, :error)
end
