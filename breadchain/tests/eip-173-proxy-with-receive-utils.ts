import { newMockEvent } from "matchstick-as"
import { ethereum, Address } from "@graphprotocol/graph-ts"
import {
  ProxyAdminTransferred,
  ProxyImplementationUpdated
} from "../generated/EIP173ProxyWithReceive/EIP173ProxyWithReceive"

export function createProxyAdminTransferredEvent(
  previousAdmin: Address,
  newAdmin: Address
): ProxyAdminTransferred {
  let proxyAdminTransferredEvent = changetype<ProxyAdminTransferred>(
    newMockEvent()
  )

  proxyAdminTransferredEvent.parameters = new Array()

  proxyAdminTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousAdmin",
      ethereum.Value.fromAddress(previousAdmin)
    )
  )
  proxyAdminTransferredEvent.parameters.push(
    new ethereum.EventParam("newAdmin", ethereum.Value.fromAddress(newAdmin))
  )

  return proxyAdminTransferredEvent
}

export function createProxyImplementationUpdatedEvent(
  previousImplementation: Address,
  newImplementation: Address
): ProxyImplementationUpdated {
  let proxyImplementationUpdatedEvent = changetype<ProxyImplementationUpdated>(
    newMockEvent()
  )

  proxyImplementationUpdatedEvent.parameters = new Array()

  proxyImplementationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "previousImplementation",
      ethereum.Value.fromAddress(previousImplementation)
    )
  )
  proxyImplementationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newImplementation",
      ethereum.Value.fromAddress(newImplementation)
    )
  )

  return proxyImplementationUpdatedEvent
}
