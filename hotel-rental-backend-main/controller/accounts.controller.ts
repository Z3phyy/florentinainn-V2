import { Response, response } from "express";
import { AuthRequest } from "../types/request.type";
import { accountInterface, accountInterfaceInput } from "../types/accounts.type";
import { AccountService } from "../services/acccount.service";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { AdminService } from "../services/admin.service";
import { validatePassword, validateEmail } from "../utils/validation";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import { getJwtSecret } from "../config/jwt";

const secret = getJwtSecret()


export class AccountController {

  static createAccount = async (request : AuthRequest , response : Response) => {

    const accountData : accountInterfaceInput = request.body

    // isApproved is a required schema field; the staff registration form sends it.
    // Default to pending approval so an omitted value cannot crash the request.
    if (typeof accountData.isApproved !== "boolean") {
      accountData.isApproved = false
    }

    const emailErr = validateEmail(accountData.email);
    if (emailErr) {
      response.status(400).send(emailErr);
      return;
    }

    const passErr = validatePassword(accountData.password);
    if (passErr) {
      response.status(400).send(passErr);
      return;
    }

    if(await AccountService.checkEmail(accountData.email)){
        response.status(400).send("Email already registered")
        return
    }

    if(await AdminService.getByEmail(accountData.email)){
        response.status(400).send("Email already registered in admin account")
        return
    }

    const hashedPassword = await bcrypt.hash(accountData.password, 10);
    accountData.password = hashedPassword

    const account = await AccountService.create(accountData)
    await logAuditAction({
      action: "STAFF_REGISTERED",
      details: `New staff registered: ${accountData.name} (${accountData.email})`,
      actorName: accountData.name,
      targetType: "staff",
    });

    await notify({
      type: "account",
      title: `Staff Registration Awaiting Approval: ${accountData.name}`,
      message: `${accountData.email} registered and is awaiting admin approval.`,
      severity: "warning",
      link: "/pages/admin/staff",
      targetType: "staff",
      targetId: account._id ? String(account._id) : undefined,
    });

    response.send(account)
  }

static checkEmailAvailability = async (request: AuthRequest, response: Response) => {
    const email = (request.params.email || "").toLowerCase().trim();

    if (!email) {
      response.status(400).send("Email is required")
      return
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      response.status(400).send(emailErr);
      return;
    }

    const isStaff = !!(await AccountService.checkEmail(email));
    const isAdmin = !!(await AdminService.getByEmail(email));

    response.send({
      available: !isStaff && !isAdmin,
      takenBy: isAdmin ? "admin" : isStaff ? "staff" : null,
    })
  }

static login = async (request: AuthRequest, response: Response) => {
  try {
    const { email, password } = request.body;

    // Check both employee account and admin account
    const account = await AccountService.checkEmail(email);
    const adminAccount = await AdminService.getByEmail(email);

    // User does not exist
    if (!account && !adminAccount) {
      response.status(404).send("User not found");
      return;
    }

    let authenticatedAccount: any = null;
    let role: "super admin" | "admin" | "employee" = "employee";

    // 1. Try checking Admin credentials first if admin exists
    if (adminAccount) {
      const isMatch = await bcrypt.compare(password, adminAccount.password);
      if (isMatch) {
        authenticatedAccount = adminAccount;
        role = adminAccount.type as "super admin" | "admin";
      }
    }

    // 2. If not authenticated as admin, try checking Staff/Employee credentials
    if (!authenticatedAccount && account) {
      if (account.isApproved === false) {
        response.status(403).send("Account is pending approval");
        return;
      }
      const isMatch = await bcrypt.compare(password, account.password);
      if (isMatch) {
        authenticatedAccount = account;
        role = "employee";
      }
    }

    // If neither matched
    if (!authenticatedAccount) {
      response.status(401).send("Incorrect password");
      return;
    }

    // Create token with id, role, and name
    const token = jwt.sign(
      {
        id: authenticatedAccount._id,
        role,
        name: authenticatedAccount.name || (role === "super admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff"),
      },
      secret,
      { expiresIn: "3d" }
    );

    const safeAccount = authenticatedAccount?.toObject
      ? authenticatedAccount.toObject()
      : { ...authenticatedAccount };
    delete safeAccount.password;
    delete safeAccount.otp;
    delete safeAccount.otpExpiresAt;

    response.send({
      account: safeAccount,
      token,
      role,
    });

  } catch (error) {
    console.error(error);
    response.status(500).send("Server error");
  }
};

  static getAccounts = async (request : AuthRequest , response : Response) => {
    const accounts = await AccountService.getAll()
    response.send(accounts)
  }

  static updateAccount = async (request : AuthRequest , response : Response) => {
    const { _id, name, email, password, permisions } = request.body
    const updateData: Partial<accountInterfaceInput> = { name, email, permisions, isApproved: true, otp: null }
    if (password && typeof password === "string" && password.trim() !== "") {
      if (/^\$2[aby]\$/.test(password)) {
        updateData.password = password
      } else {
        updateData.password = await bcrypt.hash(password, 10)
      }
    }
    await AccountService.update(_id, updateData as accountInterfaceInput)
    await logAuditAction({
      action: "STAFF_UPDATED",
      details: `Updated staff permissions for ${name || email}`,
      actorName: request.account?.name || "Administrator",
      actorRole: request.account?.type || "admin",
      targetType: "staff",
      targetId: _id,
    })
    const accounts = await AccountService.getAll()
    response.send(accounts)
  }

  static deleteAccount = async (request : AuthRequest , response : Response) => {
    const { _id } = request.body
    await AccountService.delete(_id)
    await logAuditAction({
      action: "STAFF_DELETED",
      details: `Removed staff account ${_id}`,
      actorName: request.account?.name || "Administrator",
      actorRole: request.account?.type || "admin",
      targetType: "staff",
      targetId: _id,
    })
    const accounts = await AccountService.getAll()
    response.send(accounts)
  }


  static approveAccount = async (request : AuthRequest , response : Response) => {
    try {
      const { _id } = request.body

      if (!_id) {
        response.status(400).send("Account id is required")
        return
      }

      const account = await AccountService.get(_id)

      if (!account) {
        response.status(404).send("Account not found")
        return
      }

      await AccountService.approve(_id)
      await logAuditAction({
        action: "STAFF_APPROVED",
        details: `Approved staff access for ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      })

      await notify({
        type: "account",
        title: `Staff Approved: ${account.name}`,
        message: `${account.email} was granted staff access.`,
        severity: "success",
        link: "/pages/admin/staff",
        targetType: "staff",
        targetId: _id,
      });

      const accounts = await AccountService.getAll()
      response.send(accounts)
    } catch (error) {
      console.log("Failed to approve account: " + (error as Error).message)
      response.status(500).send("Failed to approve account: " + (error as Error).message)
    }
  }

  static rejectAccount = async (request : AuthRequest , response : Response) => {
    try {
      const { _id } = request.body

      if (!_id) {
        response.status(400).send("Account id is required")
        return
      }

      const account = await AccountService.get(_id)

      if (!account) {
        response.status(404).send("Account not found")
        return
      }

      await AccountService.delete(_id)
      await logAuditAction({
        action: "STAFF_REJECTED",
        details: `Rejected & removed staff application for ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      })

      await notify({
        type: "account",
        title: `Staff Application Rejected: ${account.name}`,
        message: `${account.email} application was rejected.`,
        severity: "danger",
        link: "/pages/admin/staff",
        targetType: "staff",
        targetId: _id,
      });

      const accounts = await AccountService.getAll()
      response.send(accounts)
    } catch (error) {
      console.log("Failed to reject account: " + (error as Error).message)
      response.status(500).send("Failed to reject account: " + (error as Error).message)
    }
  }


  static changeCredentials = async (request : AuthRequest , response : Response) => {
    try {
      const { oldEmail, oldPassword, name, newEmail, newPassword } = request.body
      const accountId = request.account?._id

      if (!accountId) {
        response.status(401).json({ message: "Unauthorized" })
        return
      }

      // Verify old credentials belong to the authenticated user
      const account = await AccountService.checkEmail(oldEmail)
      if (!account || account._id.toString() !== accountId) {
        response.status(400).json({ message: "Account not found for provided current email" })
        return
      }

      const isMatch = await bcrypt.compare(oldPassword, account.password);

      if(!isMatch){
          response.status(400).json({ message: "Incorrect current password" })
          return
      }

      // Check if new email is already taken (if changing email)
      if (newEmail && newEmail !== oldEmail) {
        const emailErr = validateEmail(newEmail)
        if (emailErr) {
          response.status(400).json({ message: emailErr })
          return
        }

        const existing = await AccountService.checkEmail(newEmail)
        if (existing) {
          response.status(400).json({ message: "New email is already taken by another staff account" })
          return
        }
        if (await AdminService.getByEmail(newEmail)) {
          response.status(400).json({ message: "New email is already taken by an admin account" })
          return
        }
      }

      if (newPassword) {
        const passErr = validatePassword(newPassword)
        if (passErr) {
          response.status(400).json({ message: passErr })
          return
        }
      }

      const updated = await AccountService.changeCredentials(accountId, {
        name: name ? name.trim() : undefined,
        email: newEmail ? newEmail.trim() : undefined,
        password: newPassword ? await bcrypt.hash(newPassword, 10) : undefined,
      })

      response.json({
        message: "Credentials updated successfully",
        account: {
          _id: updated?._id,
          name: updated?.name,
          email: updated?.email,
        }
      })
    } catch (error) {
      console.error(error)
      response.status(500).json({ message: "Failed to update credentials" })
    }
  }

}
