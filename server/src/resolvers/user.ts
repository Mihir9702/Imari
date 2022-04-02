import { Arg, Ctx, Query, Resolver, Int, Mutation, InputType, Field } from 'type-graphql'
import { User } from '../entities/User'
import { MyContext } from '../types'
import { hash, genSalt, compare } from 'bcryptjs'

@InputType()
class SignupInput {
  @Field()
  name!: string

  @Field()
  username!: string

  @Field()
  password!: string
}

class SignupResponse extends User {
  @Field()
  token?: string
}

@InputType()
class LoginInput {
  @Field()
  username!: string

  @Field()
  password!: string
}

@Resolver()
export class UserResolver {
  @Query(() => [User])
  users(@Ctx() { em }: MyContext): Promise<User[]> {
    return em.find(User, {})
  }

  // Create a new user 👶
  @Mutation(() => User)
  async signup(
    @Arg('params') params: SignupInput,
    @Ctx() { em }: MyContext,
  ): Promise<SignupResponse> {
    // Find if user already exists
    const user = await em.findOne(User, { username: params.username.toLowerCase() })

    // Validation Checking
    if (user) throw new Error('Username already taken')
    if (params.username.length < 4) throw new Error('Username must be at least 4 characters long')
    if (params.password.length < 8) throw new Error('Password must be at least 8 characters long')

    // Hash password
    const hashedPassword = await hash(params.password, await genSalt(10))

    // Create user
    const newUser = em.create(User, {
      ...params,
      password: hashedPassword,
    })

    try {
      await em.persistAndFlush(newUser)
    } catch (err) {
      throw new Error('Error creating user')
    }

    return { ...newUser }
  }

  @Mutation(() => User)
  async login(@Arg('params') params: LoginInput, @Ctx() { em, req }: MyContext): Promise<User> {
    // Find user
    const user = await em.findOne(User, { username: params.username.toLowerCase() })

    // Compare password
    const valid = await compare(params.password, user!.password)

    // Throw error if username or password is invalid
    if (!user || !valid) {
      throw new Error('Invalid username or password')
    }

    // @ts-ignore
    req.session.userId = user.id

    return user
  }

  // Update a user 🌀
  @Mutation(() => User)
  async updateUser(
    @Arg('id', () => Int) id: number,
    @Arg('name', () => String) name: string,
    @Ctx() { em }: MyContext,
  ): Promise<User> {
    const user = await em.findOne(User, { id })
    if (!user) {
      throw new Error('User not found')
    }
    if (typeof name !== 'undefined') {
      user.name = name
      await em.persistAndFlush(user)
    }
    return user
  }

  // Delete a user ❌
  @Mutation(() => Boolean)
  async deleteUser(@Arg('id', () => Int) id: number, @Ctx() { em }: MyContext): Promise<boolean> {
    try {
      await em.nativeDelete(User, { id })
      return true
    } catch (err) {
      throw new Error('User not found')
    }
  }
}
